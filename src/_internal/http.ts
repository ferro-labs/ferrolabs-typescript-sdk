import {
  FerroAPIError,
  FerroAuthError,
  FerroConnectionError,
  FerroNotFoundError,
  FerroRateLimitError,
  FerroServerError,
} from "../errors.js";
import { VERSION } from "../version.js";

export interface HttpClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
  defaultHeaders: Record<string, string>;
  fetchFn: typeof globalThis.fetch;
}

export class HttpClient {
  private readonly config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = config;
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

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
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
          await this.handleErrorResponse(response);
        }

        if (response.status === 204) {
          return undefined as T;
        }

        const text = await response.text();
        if (!text) return undefined as T;

        return JSON.parse(text) as T;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof FerroAPIError) throw error;

        if (this.isRetryable(error) && attempt < this.config.maxRetries) {
          lastError = error as Error;
          continue;
        }

        if (this.isAbortError(error)) {
          throw new FerroConnectionError(
            `Request timed out after ${this.config.timeout}ms`,
          );
        }

        throw new FerroConnectionError(
          `Connection failed: ${(error as Error).message}`,
        );
      }
    }

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
