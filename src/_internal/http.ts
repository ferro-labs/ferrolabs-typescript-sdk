import {
  FerroAPIError,
  FerroAuthError,
  FerroBudgetExceededError,
  FerroConnectionError,
  FerroNotFoundError,
  FerroPermissionError,
  FerroRateLimitError,
  FerroServerError,
} from "../errors.js";
import { VERSION } from "../version.js";
import type { Logger } from "./logger.js";

// Same policy as the gateway's own upstream retries.
const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD", "PUT", "DELETE", "OPTIONS"]);
const BACKOFF_BASE_MS = 500;
const BACKOFF_CAP_MS = 8_000;
const RETRY_AFTER_CAP_MS = 30_000;

export interface HttpClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
  defaultHeaders: Record<string, string>;
  fetchFn: typeof globalThis.fetch;
  logger: Logger;
}

export interface RequestOptions {
  json?: unknown;
  params?: Record<string, string>;
  /** Merge gateway headers into the body — inference responses only. */
  meta?: boolean;
  /** Extra statuses to treat as success (e.g. 503 from `/health`). */
  acceptStatus?: number[];
}

export class HttpClient {
  private readonly config: HttpClientConfig;
  private readonly log: Logger;

  constructor(config: HttpClientConfig) {
    this.config = config;
    this.log = config.logger;
  }

  /** The configured request timeout; also the stream idle timeout. */
  get timeout(): number {
    return this.config.timeout;
  }

  async request<T>(
    method: string,
    path: string,
    options?: RequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const headers = this.buildHeaders();
    const body = options?.json ? JSON.stringify(options.json) : undefined;

    const startTime = Date.now();

    this.log.debug("request start", { method, url });

    for (let attempt = 0; ; attempt++) {
      if (attempt > 0) {
        this.log.debug("request retry", { method, url, attempt });
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.config.timeout,
      );

      try {
        const response = await this.config.fetchFn(url, {
          method,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const accepted =
          response.ok ||
          (options?.acceptStatus?.includes(response.status) ?? false);

        if (!accepted) {
          this.log.warn("request error response", {
            method,
            url,
            status: response.status,
            elapsed_ms: Date.now() - startTime,
          });
          if (
            shouldRetry(method, { status: response.status }) &&
            attempt < this.config.maxRetries
          ) {
            await response.text().catch(() => "");
            await sleep(retryDelay(attempt, retryAfterSeconds(response)));
            continue;
          }
          await this.handleErrorResponse(response);
        }

        this.log.debug("request complete", {
          method,
          url,
          status: response.status,
          elapsed_ms: Date.now() - startTime,
        });

        if (response.status === 204) {
          return undefined as T;
        }

        const text = await response.text();
        if (!text) return undefined as T;

        const parsed = JSON.parse(text);
        return (
          options?.meta ? mergeResponseMetadata(parsed, response) : parsed
        ) as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof FerroAPIError) throw error;

        if (
          shouldRetry(method, { error }) &&
          attempt < this.config.maxRetries
        ) {
          this.log.warn("request retryable error", {
            method,
            url,
            attempt,
            error: (error as Error).message,
          });
          await sleep(retryDelay(attempt));
          continue;
        }

        if (isAbortError(error)) {
          this.log.error("request timeout", {
            method,
            url,
            timeout_ms: this.config.timeout,
          });
          throw new FerroConnectionError(
            `Request timed out after ${this.config.timeout}ms`,
          );
        }

        this.log.error("request connection failed", {
          method,
          url,
          error: (error as Error).message,
        });
        throw new FerroConnectionError(
          `Connection failed: ${(error as Error).message}`,
        );
      }
    }
  }

  /**
   * Open an SSE response. Never retried. The caller owns the body; wrap it in
   * `Stream` to iterate frames with the idle timeout and cancel semantics.
   */
  async stream(
    method: string,
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const url = this.buildUrl(path);
    const headers = { ...this.buildHeaders(), Accept: "text/event-stream" };

    this.log.debug("stream start", { method, url });

    // Bounds the connection + headers phase only; Stream bounds each read.
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(
      () => timeoutController.abort(),
      this.config.timeout,
    );

    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal;

    let response: Response;
    try {
      response = await this.config.fetchFn(url, {
        method,
        headers,
        body: JSON.stringify(body),
        signal: combinedSignal,
      });
    } catch (error) {
      if (isAbortError(error)) {
        if (signal?.aborted) {
          throw new FerroConnectionError("Stream aborted by caller");
        }
        throw new FerroConnectionError(
          `Stream timed out after ${this.config.timeout}ms`,
        );
      }
      throw new FerroConnectionError(
        `Stream connection failed: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    return response;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(path, this.config.baseUrl);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private buildHeaders(): Record<string, string> {
    // defaultHeaders first so a caller can never shadow Authorization.
    const headers: Record<string, string> = {
      ...this.config.defaultHeaders,
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "X-Gateway-Client": `ferrolabsai-typescript/${VERSION}`,
    };

    if (typeof process !== "undefined" && process.versions?.node) {
      headers["User-Agent"] = `ferrolabsai-typescript/${VERSION}`;
    }

    return headers;
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const requestId = response.headers.get("x-request-id") ?? undefined;

    let message: string;
    let code: string | undefined;

    try {
      const body = (await response.json()) as Record<string, unknown>;
      const error = body["error"] as Record<string, unknown> | undefined;
      message =
        (error?.["message"] as string) ??
        (body["message"] as string) ??
        response.statusText;
      code = (error?.["code"] as string) ?? (body["code"] as string);
    } catch {
      message = (await response.text().catch(() => "")) || response.statusText;
    }

    const options = { code, requestId };

    switch (response.status) {
      case 401:
        throw new FerroAuthError(message, options);
      case 402:
        throw new FerroBudgetExceededError(message, options);
      case 403:
        throw new FerroPermissionError(message, options);
      case 404:
        throw new FerroNotFoundError(message, options);
      case 429:
        throw new FerroRateLimitError(message, {
          ...options,
          retryAfter: retryAfterSeconds(response),
        });
      default:
        if (response.status >= 500) {
          throw new FerroServerError(message, {
            ...options,
            status: response.status,
          });
        }
        throw new FerroAPIError(message, {
          ...options,
          status: response.status,
        });
    }
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/**
 * Whether a failed attempt may be re-sent. Pass either the response `status`
 * or the `error` thrown by `fetch`.
 *
 * - 429 and a network failure before any response: retried for every method —
 *   the gateway did not process the request.
 * - 408/5xx and the SDK's own per-attempt timeout: idempotent methods only.
 *   `fetch` cannot tell a connect timeout from a read timeout, so a POST that
 *   timed out may already have been executed.
 */
export function shouldRetry(
  method: string,
  outcome: { status?: number; error?: unknown },
): boolean {
  const idempotent = IDEMPOTENT_METHODS.has(method.toUpperCase());
  if (outcome.status !== undefined) {
    if (outcome.status === 429) return true;
    return idempotent && RETRY_STATUSES.has(outcome.status);
  }
  if (outcome.error instanceof TypeError) return true;
  return idempotent && isAbortError(outcome.error);
}

/**
 * Delay before retry `attempt` (0-based): `Retry-After` when the server sent
 * one (capped at 30 s, like the gateway), else capped exponential backoff
 * with full jitter.
 */
export function retryDelay(attempt: number, retryAfterSec?: number): number {
  if (retryAfterSec !== undefined) {
    return Math.min(retryAfterSec * 1000, RETRY_AFTER_CAP_MS);
  }
  const ceiling = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
  return Math.random() * ceiling;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `Retry-After` in seconds; `undefined` when absent or not a number. */
// ponytail: delta-seconds only; the gateway never sends the HTTP-date form.
export function retryAfterSeconds(response: Response): number | undefined {
  const raw = response.headers.get("retry-after");
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * Copy the gateway's metadata headers into an inference response body.
 *
 * - `trace_id` ← `X-Request-ID` (every response)
 * - `provider` ← body `provider` (chat) or `X-Gateway-Provider` (pass-through)
 * - `gateway_overhead_ms` ← `X-Gateway-Overhead-Ms` (non-streaming chat only)
 *
 * Body fields stay authoritative when both sources are present. Only called
 * for inference bodies — never for `/v1/models`, `/health` or `/admin/*`.
 */
export function mergeResponseMetadata(
  parsed: unknown,
  response: Response,
): unknown {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }

  const data = parsed as Record<string, unknown>;

  const traceId = response.headers.get("x-request-id");
  if (traceId && data["trace_id"] === undefined) {
    data["trace_id"] = traceId;
  }

  const provider = response.headers.get("x-gateway-provider");
  if (provider && data["provider"] === undefined) {
    data["provider"] = provider;
  }

  const overhead = Number(response.headers.get("x-gateway-overhead-ms"));
  if (
    response.headers.has("x-gateway-overhead-ms") &&
    Number.isFinite(overhead) &&
    data["gateway_overhead_ms"] === undefined
  ) {
    data["gateway_overhead_ms"] = overhead;
  }

  return data;
}
