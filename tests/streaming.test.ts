import { describe, it, expect } from "vitest";
import { Stream } from "../src/streaming.js";
import { FerroStreamError } from "../src/errors.js";
import type { HttpClient } from "../src/_internal/http.js";

function createMockHttpClient(lines: string[]): HttpClient {
  return {
    async *stream() {
      for (const line of lines) {
        yield line;
      }
    },
  } as unknown as HttpClient;
}

describe("Stream", () => {
  describe("SSE parsing", () => {
    it("parses 'data: {json}' lines into objects", async () => {
      const chunk1 = { id: "1", choices: [{ delta: { content: "Hello" } }] };
      const chunk2 = { id: "2", choices: [{ delta: { content: " world" } }] };

      const httpClient = createMockHttpClient([
        `data: ${JSON.stringify(chunk1)}`,
        `data: ${JSON.stringify(chunk2)}`,
        "data: [DONE]",
      ]);

      const stream = Stream.fromSSE<typeof chunk1>(
        httpClient,
        "POST",
        "/v1/chat/completions",
        {},
      );

      const results: unknown[] = [];
      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual(chunk1);
      expect(results[1]).toEqual(chunk2);
    });

    it("stops on 'data: [DONE]'", async () => {
      const chunk1 = { id: "1" };
      const chunkAfterDone = { id: "should-not-appear" };

      const httpClient = createMockHttpClient([
        `data: ${JSON.stringify(chunk1)}`,
        "data: [DONE]",
        `data: ${JSON.stringify(chunkAfterDone)}`,
      ]);

      const stream = Stream.fromSSE<typeof chunk1>(
        httpClient,
        "POST",
        "/v1/chat/completions",
        {},
      );

      const results: unknown[] = [];
      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(chunk1);
    });

    it("skips non-'data:' lines", async () => {
      const chunk1 = { id: "1" };

      const httpClient = createMockHttpClient([
        ": comment line",
        "event: ping",
        `data: ${JSON.stringify(chunk1)}`,
        "retry: 3000",
        "data: [DONE]",
      ]);

      const stream = Stream.fromSSE<typeof chunk1>(
        httpClient,
        "POST",
        "/v1/chat/completions",
        {},
      );

      const results: unknown[] = [];
      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(chunk1);
    });

    it("throws FerroStreamError on invalid JSON", async () => {
      const httpClient = createMockHttpClient(["data: {not valid json"]);

      const stream = Stream.fromSSE<unknown>(
        httpClient,
        "POST",
        "/v1/chat/completions",
        {},
      );

      const results: unknown[] = [];
      await expect(async () => {
        for await (const chunk of stream) {
          results.push(chunk);
        }
      }).rejects.toThrow(FerroStreamError);
    });

    it("throws FerroStreamError with payload info", async () => {
      const httpClient = createMockHttpClient(["data: broken{json"]);

      const stream = Stream.fromSSE<unknown>(
        httpClient,
        "POST",
        "/v1/chat/completions",
        {},
      );

      await expect(async () => {
        for await (const _ of stream) {
          void _;
        }
      }).rejects.toThrow(/Failed to parse SSE payload/);
    });

    it("handles empty stream", async () => {
      const httpClient = createMockHttpClient([]);

      const stream = Stream.fromSSE<unknown>(
        httpClient,
        "POST",
        "/v1/chat/completions",
        {},
      );

      const results: unknown[] = [];
      for await (const chunk of stream) {
        results.push(chunk);
      }

      expect(results).toHaveLength(0);
    });
  });

  describe("abort", () => {
    it("has an abort method", () => {
      async function* empty(): AsyncGenerator<string> {
        // empty
      }
      const stream = new Stream<string>(empty());
      expect(typeof stream.abort).toBe("function");
    });
  });
});
