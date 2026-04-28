import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FerroClient } from "../src/client.js";
import { FerroAuthError } from "../src/errors.js";
import { VERSION } from "../src/version.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

describe("FerroClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env["FERRO_API_KEY"];
    delete process.env["OPENAI_API_KEY"];
    delete process.env["FERRO_BASE_URL"];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("API key resolution", () => {
    it("uses API key from constructor param", () => {
      const { fetch } = createMockFetch({ json: { data: [] } });
      const client = new FerroClient({ apiKey: "sk-from-param", fetch });
      expect(client).toBeDefined();
    });

    it("uses FERRO_API_KEY env var when no param provided", () => {
      process.env["FERRO_API_KEY"] = "sk-from-ferro-env";
      const { fetch } = createMockFetch({ json: { data: [] } });
      const client = new FerroClient({ fetch });
      expect(client).toBeDefined();
    });

    it("falls back to OPENAI_API_KEY env var", () => {
      process.env["OPENAI_API_KEY"] = "sk-from-openai-env";
      const { fetch } = createMockFetch({ json: { data: [] } });
      const client = new FerroClient({ fetch });
      expect(client).toBeDefined();
    });

    it("prefers FERRO_API_KEY over OPENAI_API_KEY", async () => {
      process.env["FERRO_API_KEY"] = "sk-ferro";
      process.env["OPENAI_API_KEY"] = "sk-openai";
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = new FerroClient({ fetch });
      await client.models.list();
      expect(captured[0]!.headers["Authorization"]).toBe("Bearer sk-ferro");
    });

    it("throws FerroAuthError when no API key available", () => {
      expect(() => new FerroClient()).toThrow(FerroAuthError);
    });

    it("throws FerroAuthError with descriptive message", () => {
      expect(() => new FerroClient()).toThrow(/API key is required/);
    });
  });

  describe("base URL resolution", () => {
    it("uses base URL from constructor param", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = new FerroClient({
        apiKey: "sk-test",
        baseUrl: "https://custom.example.com",
        fetch,
      });
      await client.models.list();
      expect(captured[0]!.url).toMatch(/^https:\/\/custom\.example\.com\//);
    });

    it("uses FERRO_BASE_URL env var when no param provided", async () => {
      process.env["FERRO_BASE_URL"] = "https://env.example.com";
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = new FerroClient({ apiKey: "sk-test", fetch });
      await client.models.list();
      expect(captured[0]!.url).toMatch(/^https:\/\/env\.example\.com\//);
    });

    it("defaults to http://localhost:8080", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = new FerroClient({ apiKey: "sk-test", fetch });
      await client.models.list();
      expect(captured[0]!.url).toMatch(/^http:\/\/localhost:8080\//);
    });

    it("strips trailing slash from base URL param", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = new FerroClient({
        apiKey: "sk-test",
        baseUrl: "https://example.com/",
        fetch,
      });
      await client.models.list();
      expect(captured[0]!.url).not.toMatch(/\/\/v1/);
    });

    it("strips trailing slashes from FERRO_BASE_URL env var", async () => {
      process.env["FERRO_BASE_URL"] = "https://env.example.com///";
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = new FerroClient({ apiKey: "sk-test", fetch });
      await client.models.list();
      expect(captured[0]!.url).toMatch(/^https:\/\/env\.example\.com\//);
    });
  });

  describe("maxRetries validation", () => {
    it("throws for negative maxRetries", () => {
      expect(
        () => new FerroClient({ apiKey: "sk-test", maxRetries: -1 }),
      ).toThrow("maxRetries must be a non-negative integer");
    });

    it("throws for non-integer maxRetries", () => {
      expect(
        () => new FerroClient({ apiKey: "sk-test", maxRetries: 2.5 }),
      ).toThrow("maxRetries must be a non-negative integer");
    });

    it("accepts zero maxRetries", () => {
      const client = new FerroClient({ apiKey: "sk-test", maxRetries: 0 });
      expect(client).toBeDefined();
    });

    it("accepts positive integer maxRetries", () => {
      const client = new FerroClient({ apiKey: "sk-test", maxRetries: 5 });
      expect(client).toBeDefined();
    });
  });

  describe("version property", () => {
    it("returns VERSION constant", () => {
      const client = new FerroClient({ apiKey: "sk-test" });
      expect(client.version).toBe(VERSION);
    });
  });

  describe("resource namespaces", () => {
    it("exposes chat.completions", () => {
      const client = new FerroClient({ apiKey: "sk-test" });
      expect(client.chat).toBeDefined();
      expect(client.chat.completions).toBeDefined();
    });

    it("exposes embeddings", () => {
      const client = new FerroClient({ apiKey: "sk-test" });
      expect(client.embeddings).toBeDefined();
    });

    it("exposes images", () => {
      const client = new FerroClient({ apiKey: "sk-test" });
      expect(client.images).toBeDefined();
    });

    it("exposes models", () => {
      const client = new FerroClient({ apiKey: "sk-test" });
      expect(client.models).toBeDefined();
    });

    it("exposes admin", () => {
      const client = new FerroClient({ apiKey: "sk-test" });
      expect(client.admin).toBeDefined();
    });
  });
});
