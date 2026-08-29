import { FerroConnectionError, FerroStreamError } from "./errors.js";
import type { HttpClient } from "./_internal/http.js";

const DEFAULT_IDLE_TIMEOUT_MS = 120_000;

type ReadResult = Awaited<
  ReturnType<ReadableStreamDefaultReader<Uint8Array>["read"]>
>;

export interface StreamOptions {
  /** Aborting this controller ends iteration cleanly. */
  controller?: AbortController;
  /** Reject with `FerroConnectionError` when no bytes arrive for this long. */
  idleTimeoutMs?: number;
}

/**
 * Async-iterable SSE stream over a gateway `Response`.
 *
 * Frames are `\n\n`-delimited; multi-line `data:` lines are joined; `event:`,
 * `id:`, `retry:` and comments are ignored. `data: [DONE]` ends the stream and
 * a `{"error": ...}` frame becomes a `FerroStreamError`. Breaking out of the
 * loop cancels the underlying reader.
 */
export class Stream<T> implements AsyncIterable<T> {
  /** `X-Request-ID` of the streaming response (32 hex, the OTel trace id). */
  readonly trace_id: string | undefined;
  /** `X-Gateway-Provider` when the gateway sent it (not on SSE in v1.4.x). */
  readonly provider: string | undefined;

  private readonly response: Response;
  private readonly controller: AbortController;
  private readonly idleTimeoutMs: number;

  constructor(response: Response, options?: StreamOptions) {
    this.response = response;
    this.controller = options?.controller ?? new AbortController();
    this.idleTimeoutMs = options?.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.trace_id = response.headers.get("x-request-id") ?? undefined;
    this.provider = response.headers.get("x-gateway-provider") ?? undefined;
  }

  static async fromSSE<T>(
    httpClient: HttpClient,
    method: string,
    path: string,
    body: unknown,
  ): Promise<Stream<T>> {
    const controller = new AbortController();
    const response = await httpClient.stream(
      method,
      path,
      body,
      controller.signal,
    );
    return new Stream<T>(response, {
      controller,
      idleTimeoutMs: httpClient.timeout,
    });
  }

  abort(): void {
    this.controller.abort();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    if (!this.response.body) {
      throw new FerroConnectionError("Response body is null");
    }

    const reader = this.response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (!this.controller.signal.aborted) {
        const result = await this.read(reader);
        if (result === "aborted") return;

        buffer += result.done
          ? decoder.decode()
          : decoder.decode(result.value, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");

        const frames = buffer.split("\n\n");
        buffer = result.done ? "" : (frames.pop() ?? "");

        for (const frame of frames) {
          if (this.controller.signal.aborted) return;
          const payload = dataOf(frame);
          if (payload === undefined) continue;
          if (payload.trim() === "[DONE]") return;
          yield this.decode(payload);
        }

        if (result.done) return;
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }

  /** One `reader.read()` bounded by the idle timeout and the abort signal. */
  private async read(
    reader: ReadableStreamDefaultReader<Uint8Array>,
  ): Promise<ReadResult | "aborted"> {
    const signal = this.controller.signal;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;

    const idle = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new FerroConnectionError(
              `Stream idle for ${this.idleTimeoutMs}ms; giving up`,
            ),
          ),
        this.idleTimeoutMs,
      );
    });
    const aborted = new Promise<"aborted">((resolve) => {
      onAbort = () => resolve("aborted");
      signal.addEventListener("abort", onAbort, { once: true });
    });

    try {
      return await Promise.race([reader.read(), idle, aborted]);
    } catch (error) {
      if (signal.aborted) return "aborted";
      if (error instanceof FerroConnectionError) {
        this.controller.abort();
        throw error;
      }
      throw new FerroConnectionError(
        `Stream read failed: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timer);
      if (onAbort) signal.removeEventListener("abort", onAbort);
    }
  }

  private decode(payload: string): T {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      throw new FerroStreamError(`Failed to parse SSE payload: ${payload}`);
    }

    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return parsed as T;
    }

    const record = parsed as Record<string, unknown>;
    const error = record["error"] as Record<string, unknown> | undefined;
    if (error && typeof error === "object") {
      throw new FerroStreamError(
        (error["message"] as string | undefined) ?? "stream error",
        { code: error["code"] as string | undefined },
      );
    }

    if (this.trace_id && record["trace_id"] === undefined) {
      record["trace_id"] = this.trace_id;
    }
    if (this.provider && record["provider"] === undefined) {
      record["provider"] = this.provider;
    }
    return record as T;
  }
}

/** Joined `data:` payload of one SSE frame, or `undefined` if it has none. */
function dataOf(frame: string): string | undefined {
  const lines = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""));
  return lines.length > 0 ? lines.join("\n") : undefined;
}
