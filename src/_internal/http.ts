import {
  FerroAPIError,
  FerroAuthError,
  FerroConnectionError,
  FerroNotFoundError,
  FerroRateLimitError,
  FerroServerError,
} from "../errors.js";
import { VERSION } from "../version.js";
import type { Logger } from "./logger.js";

export interface HttpClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
  defaultHeaders: Record<string, string>;
  fetchFn: typeof globalThis.fetch;
  logger: Logger;
}

export class HttpClient {
  private readonly config: HttpClientConfig;
  private readonly log: Logger;

  constructor(config: HttpClientConfig) {
    this.config = config;
    this.log = config.logger;
  }

  async request<T>(
    method: string,
    path: string,
    options?: { json?: unknown; params?: Record<string, string> },
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const headers = this.buildHeaders();
    const body = options?.json ? JSON.stringify(options.json) : undefined;

    let lastError: Error | undefined;
    const startTime = Date.now();

    this.log.debug("request start", { method, url });

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
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

        if (!response.ok) {
          this.log.warn("request error response", {
            method,
            url,
            status: response.status,
            elapsed_ms: Date.now() - startTime,
          });
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
        return mergeResponseMetadata(parsed, response) as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof FerroAPIError) throw error;

        if (this.isRetryable(error) && attempt < this.config.maxRetries) {
          this.log.warn("request retryable error", {
            method,
            url,
            attempt,
            error: (error as Error).message,
          });
          lastError = error as Error;
          continue;
        }

        if (this.isAbortError(error)) {
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

    this.log.error("request exhausted retries", {
      method,
      url,
      retries: this.config.maxRetries,
    });
    throw (
      lastError ?? new FerroConnectionError("Request failed after all retries")
    );
  }

  async *stream(
    method: string,
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    const url = this.buildUrl(path);
    const headers = this.buildHeaders();

    this.log.debug("stream start", { method, url });

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
      clearTimeout(timeoutId);
      if (this.isAbortError(error)) {
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
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    if (!response.body) {
      throw new FerroConnectionError("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        if (signal?.aborted) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) yield trimmed;
        }
      }

      if (buffer.trim()) yield buffer.trim();
    } finally {
      reader.releaseLock();
    }
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
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.config.apiKey}`,
      "Content-Type": "application/json",
      "X-Ferro-Client": `ferrolabsai-typescript/${VERSION}`,
      ...this.config.defaultHeaders,
    };

    if (typeof process !== "undefined" && process.versions?.node) {
      headers["User-Agent"] = `ferrolabsai-typescript/${VERSION}`;
    }

    return headers;
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const requestId =
      response.headers.get("x-request-id") ??
      response.headers.get("x-ferro-request-id") ??
      undefined;

    let message: string;
    let code: string | undefined;
    let bodyRequestId: string | undefined;

    try {
      const body = (await response.json()) as Record<string, unknown>;
      const error = body["error"] as Record<string, unknown> | undefined;
      message =
        (error?.["message"] as string) ??
        (body["message"] as string) ??
        response.statusText;
      code = (error?.["code"] as string) ?? (body["code"] as string);
      bodyRequestId =
        (body["request_id"] as string) ?? (body["trace_id"] as string);
    } catch {
      message = (await response.text().catch(() => "")) || response.statusText;
    }

    const resolvedRequestId = requestId ?? bodyRequestId;

    switch (response.status) {
      case 401:
        throw new FerroAuthError(message, { requestId: resolvedRequestId });
      case 429:
        throw new FerroRateLimitError(message, {
          requestId: resolvedRequestId,
        });
      case 404:
        throw new FerroNotFoundError(message, {
          requestId: resolvedRequestId,
        });
      default:
        if (response.status >= 500) {
          throw new FerroServerError(message, {
            status: response.status,
            requestId: resolvedRequestId,
          });
        }
        throw new FerroAPIError(message, {
          status: response.status,
          code,
          requestId: resolvedRequestId,
        });
    }
  }

  private isRetryable(error: unknown): boolean {
    if (error instanceof TypeError) return true;
    if (this.isAbortError(error)) return true;
    return false;
  }

  private isAbortError(error: unknown): boolean {
    return (
      error instanceof DOMException ||
      (error instanceof Error && error.name === "AbortError")
    );
  }
}

/**
 * Copy gateway metadata headers into parsed response bodies.
 *
 * The gateway surfaces `trace_id`, `provider`, `cost_usd`, and `latency_ms`
 * via response headers (frozen contract since ai-gateway v1.1.0), but they are
 * not always present in the JSON body. This merges header values into the
 * parsed object so `ChatCompletion.trace_id`, `.provider`, `.latency_ms`, and
 * `usage.cost_usd` are reliably populated. Body fields stay authoritative when
 * both sources are present.
 */
function mergeResponseMetadata(parsed: unknown, response: Response): unknown {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed;
  }

  const data = parsed as Record<string, unknown>;

  const traceId =
    response.headers.get("x-request-id") ??
    response.headers.get("x-trace-id") ??
    response.headers.get("x-ferro-request-id");
  if (traceId && data["trace_id"] === undefined) {
    data["trace_id"] = traceId;
  }

  const provider = response.headers.get("x-ferro-provider");
  if (provider && data["provider"] === undefined) {
    data["provider"] = provider;
  }

  const latencyMs = headerInt(response.headers.get("x-ferro-latency-ms"));
  if (latencyMs !== undefined && data["latency_ms"] === undefined) {
    data["latency_ms"] = latencyMs;
  }

  const costUsd = headerFloat(response.headers.get("x-ferro-cost-usd"));
  if (costUsd !== undefined) {
    const usage = data["usage"];
    if (usage !== null && typeof usage === "object" && !Array.isArray(usage)) {
      const usageRecord = usage as Record<string, unknown>;
      if (usageRecord["cost_usd"] === undefined) {
        usageRecord["cost_usd"] = costUsd;
      }
    }
  }

  return data;
}

function headerInt(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function headerFloat(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}
