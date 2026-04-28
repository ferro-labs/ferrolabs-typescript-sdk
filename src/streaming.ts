import { FerroStreamError } from "./errors.js";
import type { HttpClient } from "./_internal/http.js";

export class Stream<T> implements AsyncIterable<T> {
  private readonly source: AsyncIterable<T>;
  private readonly controller: AbortController;

  constructor(source: AsyncIterable<T>, controller?: AbortController) {
    this.source = source;
    this.controller = controller ?? new AbortController();
  }

  static fromSSE<T>(
    httpClient: HttpClient,
    method: string,
    path: string,
    body: unknown,
  ): Stream<T> {
    const controller = new AbortController();
    const rawLines = httpClient.stream(method, path, body, controller.signal);

    async function* parseSSE(): AsyncGenerator<T> {
      for await (const line of rawLines) {
        if (controller.signal.aborted) return;
        if (!line.startsWith("data: ")) continue;

        const payload = line.slice(6).trim();
        if (payload === "[DONE]") return;

        try {
          yield JSON.parse(payload) as T;
        } catch {
          throw new FerroStreamError(`Failed to parse SSE payload: ${payload}`);
        }
      }
    }

    return new Stream<T>(parseSSE(), controller);
  }

  abort(): void {
    this.controller.abort();
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    yield* this.source;
  }
}
