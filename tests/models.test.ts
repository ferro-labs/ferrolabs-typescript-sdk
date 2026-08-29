import { describe, it, expect } from "vitest";
import { FerroClient } from "../src/client.js";
import { FerroNotFoundError } from "../src/errors.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

const CATALOG = [
  {
    id: "gpt-4o",
    object: "model",
    created: 0,
    owned_by: "openai",
    mode: "chat",
    context_window: 128000,
    capabilities: ["vision", "function_calling", "streaming"],
    status: "ga",
  },
  {
    id: "claude-sonnet-4-6",
    object: "model",
    created: 0,
    owned_by: "anthropic",
    mode: "chat",
    capabilities: ["function_calling", "streaming"],
  },
  {
    id: "text-embedding-3-small",
    object: "model",
    created: 0,
    owned_by: "openai",
    mode: "embedding",
  },
];

function makeClient(fetchFn: typeof globalThis.fetch) {
  return new FerroClient({ apiKey: "sk-test", fetch: fetchFn });
}

describe("Models", () => {
  describe("list", () => {
    it("fetches GET /v1/models without query params", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: CATALOG } });
      const client = makeClient(fetch);

      const result = await client.models.list();
      expect(result).toEqual(CATALOG);
      expect(captured[0]!.url).toMatch(/\/v1\/models$/);
    });

    it("handles raw array response", async () => {
      const { fetch } = createMockFetch({ json: CATALOG });
      const client = makeClient(fetch);

      expect(await client.models.list()).toEqual(CATALOG);
    });

    it("filters by provider client-side (owned_by)", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: CATALOG } });
      const client = makeClient(fetch);

      const result = await client.models.list({ provider: "anthropic" });
      expect(result.map((m) => m.id)).toEqual(["claude-sonnet-4-6"]);
      expect(captured[0]!.url).not.toContain("provider=");
    });

    it("filters by capability client-side", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: CATALOG } });
      const client = makeClient(fetch);

      const result = await client.models.list({ capability: "vision" });
      expect(result.map((m) => m.id)).toEqual(["gpt-4o"]);
      expect(captured[0]!.url).not.toContain("capability=");
    });

    it("applies both filters", async () => {
      const { fetch } = createMockFetch({ json: { data: CATALOG } });
      const client = makeClient(fetch);

      const result = await client.models.list({
        provider: "openai",
        capability: "streaming",
      });
      expect(result.map((m) => m.id)).toEqual(["gpt-4o"]);
    });
  });

  describe("retrieve", () => {
    it("looks the model up in the catalog and never calls /v1/models/{id}", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: CATALOG } });
      const client = makeClient(fetch);

      const result = await client.models.retrieve("gpt-4o");
      expect(result).toEqual(CATALOG[0]);
      expect(captured).toHaveLength(1);
      expect(captured[0]!.url).toMatch(/\/v1\/models$/);
    });

    it("throws FerroNotFoundError(model_not_found) locally for unknown ids", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: CATALOG } });
      const client = makeClient(fetch);

      try {
        await client.models.retrieve("openai/gpt-4");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(FerroNotFoundError);
        expect((err as FerroNotFoundError).code).toBe("model_not_found");
        expect((err as FerroNotFoundError).status).toBe(404);
      }
      expect(captured).toHaveLength(1);
    });
  });

  describe("search", () => {
    it("is a case-insensitive substring match on id, client-side", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: CATALOG } });
      const client = makeClient(fetch);

      const result = await client.models.search("GPT");
      expect(result.map((m) => m.id)).toEqual(["gpt-4o"]);
      expect(captured[0]!.url).not.toContain("search=");
    });

    it("handles raw array response", async () => {
      const { fetch } = createMockFetch({ json: CATALOG });
      const client = makeClient(fetch);

      const result = await client.models.search("embedding");
      expect(result.map((m) => m.id)).toEqual(["text-embedding-3-small"]);
    });
  });
});
