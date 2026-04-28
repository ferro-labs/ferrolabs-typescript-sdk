import { describe, it, expect } from "vitest";
import { FerroClient } from "../src/client.js";
import { Stream } from "../src/streaming.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

const MOCK_COMPLETION = {
  id: "chatcmpl-123",
  object: "chat.completion",
  created: 1700000000,
  model: "gpt-4",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hello!" },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  },
};

function makeClient(fetchFn: typeof globalThis.fetch) {
  return new FerroClient({ apiKey: "sk-test", fetch: fetchFn });
}

describe("Completions", () => {
  describe("create (non-streaming)", () => {
    it("sends correct request shape and parses response", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_COMPLETION });
      const client = makeClient(fetch);

      const result = await client.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(result).toEqual(MOCK_COMPLETION);

      const req = captured[0]!;
      expect(req.method).toBe("POST");
      expect(req.url).toContain("/v1/chat/completions");
      expect(req.body).toEqual({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hi" }],
      });
    });

    it("sends Authorization header", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_COMPLETION });
      const client = makeClient(fetch);

      await client.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hi" }],
      });

      expect(captured[0]!.headers["Authorization"]).toBe("Bearer sk-test");
    });

    it("only includes optional params when set", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_COMPLETION });
      const client = makeClient(fetch);

      await client.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hi" }],
      });

      const body = captured[0]!.body as Record<string, unknown>;
      expect(body).toHaveProperty("model");
      expect(body).toHaveProperty("messages");
      expect(body).not.toHaveProperty("temperature");
      expect(body).not.toHaveProperty("max_tokens");
      expect(body).not.toHaveProperty("top_p");
      expect(body).not.toHaveProperty("n");
      expect(body).not.toHaveProperty("seed");
      expect(body).not.toHaveProperty("frequency_penalty");
      expect(body).not.toHaveProperty("presence_penalty");
      expect(body).not.toHaveProperty("stop");
      expect(body).not.toHaveProperty("tools");
      expect(body).not.toHaveProperty("tool_choice");
      expect(body).not.toHaveProperty("response_format");
      expect(body).not.toHaveProperty("logprobs");
      expect(body).not.toHaveProperty("top_logprobs");
      expect(body).not.toHaveProperty("logit_bias");
      expect(body).not.toHaveProperty("user");
      expect(body).not.toHaveProperty("template_id");
      expect(body).not.toHaveProperty("template_variables");
      expect(body).not.toHaveProperty("x_route_tag");
    });

    it("includes optional params when provided", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_COMPLETION });
      const client = makeClient(fetch);

      await client.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hi" }],
        temperature: 0.7,
        max_tokens: 100,
        top_p: 0.9,
        n: 2,
        seed: 42,
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
        stop: ["\n"],
        user: "user-1",
      });

      const body = captured[0]!.body as Record<string, unknown>;
      expect(body["temperature"]).toBe(0.7);
      expect(body["max_tokens"]).toBe(100);
      expect(body["top_p"]).toBe(0.9);
      expect(body["n"]).toBe(2);
      expect(body["seed"]).toBe(42);
      expect(body["frequency_penalty"]).toBe(0.5);
      expect(body["presence_penalty"]).toBe(0.3);
      expect(body["stop"]).toEqual(["\n"]);
      expect(body["user"]).toBe("user-1");
    });

    it("sends Ferro extras: template_id, template_variables, route_tag as x_route_tag", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_COMPLETION });
      const client = makeClient(fetch);

      await client.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hi" }],
        template_id: "tmpl-abc",
        template_variables: { name: "Alice" },
        route_tag: "premium",
      });

      const body = captured[0]!.body as Record<string, unknown>;
      expect(body["template_id"]).toBe("tmpl-abc");
      expect(body["template_variables"]).toEqual({ name: "Alice" });
      expect(body["x_route_tag"]).toBe("premium");
      expect(body).not.toHaveProperty("route_tag");
    });
  });

  describe("create (streaming)", () => {
    it("returns a Stream instance when stream: true", async () => {
      const chunk = {
        id: "chatcmpl-1",
        object: "chat.completion.chunk",
        created: 1700000000,
        model: "gpt-4",
        choices: [{ index: 0, delta: { content: "Hi" }, finish_reason: null }],
      };

      const { fetch } = createMockFetch({
        stream: [
          `data: ${JSON.stringify(chunk)}`,
          "data: [DONE]",
        ],
      });
      const client = makeClient(fetch);

      const result = await client.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      expect(result).toBeInstanceOf(Stream);
    });

    it("streaming request body includes stream: true", async () => {
      const { fetch, captured } = createMockFetch({
        stream: ["data: [DONE]"],
      });
      const client = makeClient(fetch);

      const result = await client.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: "Hi" }],
        stream: true,
      });

      // Consume the stream to ensure the fetch was actually called
      for await (const _chunk of result) {
        // drain
      }

      expect(captured.length).toBeGreaterThan(0);
      const body = captured[0]!.body as Record<string, unknown>;
      expect(body["stream"]).toBe(true);
    });
  });
});
