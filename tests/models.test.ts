import { describe, it, expect } from "vitest";
import { FerroClient } from "../src/client.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

const MOCK_MODEL: Record<string, unknown> = {
  id: "gpt-4",
  object: "model",
  created: 1700000000,
  provider: "openai",
  context_window: 128000,
  capabilities: ["chat", "function_calling"],
};

function makeClient(fetchFn: typeof globalThis.fetch) {
  return new FerroClient({ apiKey: "sk-test", fetch: fetchFn });
}

describe("Models", () => {
  describe("list", () => {
    it("handles { data: [...] } response shape", async () => {
      const { fetch } = createMockFetch({
        json: { data: [MOCK_MODEL] },
      });
      const client = makeClient(fetch);

      const result = await client.models.list();
      expect(result).toEqual([MOCK_MODEL]);
    });

    it("handles raw array response", async () => {
      const { fetch } = createMockFetch({
        json: [MOCK_MODEL],
      });
      const client = makeClient(fetch);

      const result = await client.models.list();
      expect(result).toEqual([MOCK_MODEL]);
    });

    it("sends provider query param", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = makeClient(fetch);

      await client.models.list({ provider: "openai" });
      expect(captured[0]!.url).toContain("provider=openai");
    });

    it("sends capability query param", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = makeClient(fetch);

      await client.models.list({ capability: "chat" });
      expect(captured[0]!.url).toContain("capability=chat");
    });

    it("sends both provider and capability query params", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = makeClient(fetch);

      await client.models.list({ provider: "anthropic", capability: "vision" });
      const url = captured[0]!.url;
      expect(url).toContain("provider=anthropic");
      expect(url).toContain("capability=vision");
    });

    it("sends no query params when none provided", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = makeClient(fetch);

      await client.models.list();
      const url = captured[0]!.url;
      expect(url).not.toContain("provider=");
      expect(url).not.toContain("capability=");
    });
  });

  describe("retrieve", () => {
    it("calls correct URL with model ID", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_MODEL });
      const client = makeClient(fetch);

      const result = await client.models.retrieve("gpt-4");
      expect(result).toEqual(MOCK_MODEL);
      expect(captured[0]!.url).toContain("/v1/models/gpt-4");
      expect(captured[0]!.method).toBe("GET");
    });

    it("encodes model ID with special characters in URL", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_MODEL });
      const client = makeClient(fetch);

      await client.models.retrieve("openai/gpt-4");
      expect(captured[0]!.url).toContain("/v1/models/openai%2Fgpt-4");
    });

    it("encodes model ID with spaces", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_MODEL });
      const client = makeClient(fetch);

      await client.models.retrieve("my model");
      expect(captured[0]!.url).toContain("/v1/models/my%20model");
    });
  });

  describe("search", () => {
    it("sends search query param", async () => {
      const { fetch, captured } = createMockFetch({
        json: { data: [MOCK_MODEL] },
      });
      const client = makeClient(fetch);

      const result = await client.models.search("gpt");
      expect(result).toEqual([MOCK_MODEL]);
      expect(captured[0]!.url).toContain("search=gpt");
    });

    it("handles raw array response", async () => {
      const { fetch } = createMockFetch({ json: [MOCK_MODEL] });
      const client = makeClient(fetch);

      const result = await client.models.search("gpt");
      expect(result).toEqual([MOCK_MODEL]);
    });
  });
});
