import { describe, it, expect } from "vitest";
import { FerroClient } from "../src/client.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

const MOCK_EMBEDDING_RESPONSE = {
  object: "list",
  data: [
    {
      index: 0,
      embedding: [0.1, 0.2, 0.3],
      object: "embedding",
    },
  ],
  model: "text-embedding-3-small",
  usage: { prompt_tokens: 5, total_tokens: 5 },
};

function makeClient(fetchFn: typeof globalThis.fetch) {
  return new FerroClient({ apiKey: "sk-test", fetch: fetchFn });
}

describe("Embeddings", () => {
  describe("create", () => {
    it("sends correct body with required params", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_EMBEDDING_RESPONSE });
      const client = makeClient(fetch);

      const result = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello world",
      });

      expect(result).toEqual(MOCK_EMBEDDING_RESPONSE);

      const req = captured[0]!;
      expect(req.method).toBe("POST");
      expect(req.url).toContain("/v1/embeddings");
      expect(req.body).toEqual({
        model: "text-embedding-3-small",
        input: "Hello world",
      });
    });

    it("sends array input", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_EMBEDDING_RESPONSE });
      const client = makeClient(fetch);

      await client.embeddings.create({
        model: "text-embedding-3-small",
        input: ["Hello", "World"],
      });

      const body = captured[0]!.body as Record<string, unknown>;
      expect(body["input"]).toEqual(["Hello", "World"]);
    });

    it("only includes optional params when set", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_EMBEDDING_RESPONSE });
      const client = makeClient(fetch);

      await client.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello",
      });

      const body = captured[0]!.body as Record<string, unknown>;
      expect(body).not.toHaveProperty("encoding_format");
      expect(body).not.toHaveProperty("dimensions");
      expect(body).not.toHaveProperty("user");
    });

    it("includes encoding_format and dimensions when provided", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_EMBEDDING_RESPONSE });
      const client = makeClient(fetch);

      await client.embeddings.create({
        model: "text-embedding-3-small",
        input: "Hello",
        encoding_format: "base64",
        dimensions: 256,
        user: "user-1",
      });

      const body = captured[0]!.body as Record<string, unknown>;
      expect(body["encoding_format"]).toBe("base64");
      expect(body["dimensions"]).toBe(256);
      expect(body["user"]).toBe("user-1");
    });
  });
});
