import { describe, it, expect, vi } from "vitest";
import { Stream } from "../src/streaming.js";
import { FerroConnectionError, FerroStreamError } from "../src/errors.js";

/** Build an SSE Response; `chunks` are written as separate reads. */
function sseResponse(
  chunks: string[],
  options: { headers?: Record<string, string>; keepOpen?: boolean } = {},
) {
  const encoder = new TextEncoder();
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      if (!options.keepOpen) controller.close();
    },
    cancel,
  });
  const response = new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream", ...options.headers },
  });
  return { response, cancel };
}

async function collect<T>(stream: Stream<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const chunk of stream) out.push(chunk);
  return out;
}

const frame = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

describe("Stream", () => {
  describe("SSE parsing", () => {
    it("parses one frame per event and stops on [DONE]", async () => {
      const c1 = { id: "1", choices: [{ delta: { content: "Hello" } }] };
      const c2 = { id: "2", choices: [{ delta: { content: " world" } }] };
      const { response } = sseResponse([
        frame(c1) + frame(c2) + "data: [DONE]\n\n" + frame({ id: "nope" }),
      ]);

      expect(await collect(new Stream(response))).toEqual([c1, c2]);
    });

    it("reassembles frames split across reads", async () => {
      const c1 = { id: "1", text: "split" };
      const raw = frame(c1);
      const { response } = sseResponse([raw.slice(0, 7), raw.slice(7)]);

      expect(await collect(new Stream(response))).toEqual([c1]);
    });

    it("joins multi-line data: and ignores event:/id:/retry:/comments", async () => {
      const { response } = sseResponse([
        ": keepalive\n\n" +
          "event: message\nid: 7\nretry: 3000\n" +
          'data: {"a":\ndata: 1}\n\n' +
          "data: [DONE]\n\n",
      ]);

      expect(await collect(new Stream(response))).toEqual([{ a: 1 }]);
    });

    it("yields a trailing frame that lacks the final blank line", async () => {
      const { response } = sseResponse(['data: {"id":"last"}']);

      expect(await collect(new Stream(response))).toEqual([{ id: "last" }]);
    });

    it("accepts CRLF line endings", async () => {
      const { response } = sseResponse([
        'data: {"id":"1"}\r\n\r\ndata: [DONE]\r\n\r\n',
      ]);

      expect(await collect(new Stream(response))).toEqual([{ id: "1" }]);
    });

    it("throws FerroStreamError on invalid JSON", async () => {
      const { response } = sseResponse(["data: {not valid json\n\n"]);

      await expect(collect(new Stream(response))).rejects.toThrow(
        /Failed to parse SSE payload/,
      );
    });

    it("maps a mid-stream error frame to FerroStreamError with its code", async () => {
      const { response } = sseResponse([
        frame({ id: "1" }) +
          frame({
            error: {
              message: "upstream died",
              type: "stream_error",
              code: "stream_timeout",
            },
          }),
      ]);

      const stream = new Stream<{ id: string }>(response);
      const seen: unknown[] = [];
      try {
        for await (const chunk of stream) seen.push(chunk);
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(FerroStreamError);
        expect((err as FerroStreamError).code).toBe("stream_timeout");
        expect((err as FerroStreamError).message).toBe("upstream died");
      }
      expect(seen).toEqual([{ id: "1" }]);
    });

    it("handles empty stream", async () => {
      const { response } = sseResponse([]);
      expect(await collect(new Stream(response))).toEqual([]);
    });
  });

  describe("gateway metadata", () => {
    it("exposes trace_id and provider from the response and stamps every chunk", async () => {
      const { response } = sseResponse(
        [frame({ id: "1" }) + frame({ id: "2" })],
        {
          headers: {
            "x-request-id": "160b75c8487ad58d5307f3d8453c5945",
            "x-gateway-provider": "openai",
          },
        },
      );

      const stream = new Stream<Record<string, unknown>>(response);
      expect(stream.trace_id).toBe("160b75c8487ad58d5307f3d8453c5945");
      expect(stream.provider).toBe("openai");

      const chunks = await collect(stream);
      for (const chunk of chunks) {
        expect(chunk["trace_id"]).toBe("160b75c8487ad58d5307f3d8453c5945");
        expect(chunk["provider"]).toBe("openai");
      }
    });

    it("leaves provider undefined when the gateway sends no header (SSE today)", async () => {
      const { response } = sseResponse([frame({ id: "1" })], {
        headers: { "x-request-id": "abc" },
      });
      const stream = new Stream<Record<string, unknown>>(response);
      expect(stream.provider).toBeUndefined();
      const [chunk] = await collect(stream);
      expect(chunk).not.toHaveProperty("provider");
    });
  });

  describe("lifecycle", () => {
    it("cancels the reader when the consumer breaks early", async () => {
      const { response, cancel } = sseResponse(
        [frame({ id: "1" }) + frame({ id: "2" })],
        { keepOpen: true },
      );

      for await (const chunk of new Stream<{ id: string }>(response)) {
        expect(chunk.id).toBe("1");
        break;
      }
      expect(cancel).toHaveBeenCalled();
    });

    it("abort() ends iteration cleanly mid-stream", async () => {
      const { response, cancel } = sseResponse([frame({ id: "1" })], {
        keepOpen: true,
      });
      const stream = new Stream<{ id: string }>(response);

      const seen: string[] = [];
      for await (const chunk of stream) {
        seen.push(chunk.id);
        stream.abort();
      }
      expect(seen).toEqual(["1"]);
      expect(cancel).toHaveBeenCalled();
    });

    it("rejects with FerroConnectionError when the stream stalls past the idle timeout", async () => {
      const { response } = sseResponse([frame({ id: "1" })], {
        keepOpen: true,
      });
      const stream = new Stream<{ id: string }>(response, {
        idleTimeoutMs: 30,
      });

      await expect(collect(stream)).rejects.toThrow(FerroConnectionError);
    });
  });
});
