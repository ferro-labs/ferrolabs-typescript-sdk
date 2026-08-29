import { describe, it, expect } from "vitest";
import { HttpClient } from "../src/_internal/http.js";
import { Logger } from "../src/_internal/logger.js";
import {
  FerroAPIError,
  FerroAuthError,
  FerroBudgetExceededError,
  FerroPermissionError,
  FerroRateLimitError,
  FerroNotFoundError,
  FerroServerError,
  FerroConnectionError,
} from "../src/errors.js";
import { createMockFetch, createErrorFetch } from "./helpers/mock-fetch.js";

const silentLogger = new Logger("none");

function makeClient(
  fetchFn: typeof globalThis.fetch,
  overrides?: Partial<{ maxRetries: number; timeout: number }>,
) {
  return new HttpClient({
    baseUrl: "http://localhost:8080",
    apiKey: "sk-test",
    timeout: overrides?.timeout ?? 30_000,
    maxRetries: overrides?.maxRetries ?? 0,
    defaultHeaders: {},
    fetchFn,
    logger: silentLogger,
  });
}

describe("HttpClient.request", () => {
  describe("successful requests", () => {
    it("returns parsed JSON for 200 responses", async () => {
      const payload = { id: "chat-1", object: "chat.completion" };
      const { fetch } = createMockFetch({ json: payload });
      const client = makeClient(fetch);

      const result = await client.request<typeof payload>("GET", "/v1/models");
      expect(result).toEqual(payload);
    });

    it("returns undefined for 204 responses", async () => {
      const { fetch } = createMockFetch({ status: 204 });
      const client = makeClient(fetch);

      const result = await client.request<undefined>(
        "DELETE",
        "/admin/keys/k1",
      );
      expect(result).toBeUndefined();
    });

    it("returns undefined for empty response body", async () => {
      const { fetch } = createMockFetch({ text: "" });
      const client = makeClient(fetch);

      const result = await client.request<unknown>("POST", "/v1/test");
      expect(result).toBeUndefined();
    });

    it("sends correct Authorization header", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      await client.request("GET", "/v1/models");
      expect(captured[0]!.headers["Authorization"]).toBe("Bearer sk-test");
    });

    it("sends correct Content-Type header", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      await client.request("GET", "/v1/models");
      expect(captured[0]!.headers["Content-Type"]).toBe("application/json");
    });

    it("sends X-Gateway-Client header with SDK version", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      await client.request("GET", "/v1/models");
      expect(captured[0]!.headers["X-Gateway-Client"]).toMatch(
        /^ferrolabsai-typescript\//,
      );
    });

    it("defaultHeaders cannot override Authorization", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = new HttpClient({
        baseUrl: "http://localhost:8080",
        apiKey: "sk-test",
        timeout: 30_000,
        maxRetries: 0,
        defaultHeaders: { Authorization: "Bearer evil", "x-env": "prod" },
        fetchFn: fetch,
        logger: silentLogger,
      });

      await client.request("GET", "/v1/models");
      expect(captured[0]!.headers["Authorization"]).toBe("Bearer sk-test");
      expect(captured[0]!.headers["x-env"]).toBe("prod");
    });

    it("sends User-Agent in Node-like environments", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      await client.request("GET", "/v1/models");
      expect(captured[0]!.headers["User-Agent"]).toMatch(
        /^ferrolabsai-typescript\//,
      );
    });

    it("sends JSON body for POST requests", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      await client.request("POST", "/v1/chat/completions", {
        json: { model: "gpt-4", messages: [] },
      });

      expect(captured[0]!.body).toEqual({ model: "gpt-4", messages: [] });
    });
  });

  describe("query params", () => {
    it("appends query params to URL", async () => {
      const { fetch, captured } = createMockFetch({ json: [] });
      const client = makeClient(fetch);

      await client.request("GET", "/v1/models", {
        params: { provider: "openai", capability: "chat" },
      });

      const url = captured[0]!.url;
      expect(url).toContain("provider=openai");
      expect(url).toContain("capability=chat");
    });
  });

  describe("error responses", () => {
    it("throws FerroAuthError on 401", async () => {
      const { fetch } = createMockFetch({
        status: 401,
        json: { error: { message: "Invalid API key" } },
      });
      const client = makeClient(fetch);

      await expect(client.request("GET", "/v1/models")).rejects.toThrow(
        FerroAuthError,
      );
    });

    it("throws FerroRateLimitError on 429", async () => {
      const { fetch } = createMockFetch({
        status: 429,
        json: { error: { message: "Rate limited" } },
      });
      const client = makeClient(fetch);

      await expect(client.request("GET", "/v1/models")).rejects.toThrow(
        FerroRateLimitError,
      );
    });

    it("throws FerroNotFoundError on 404", async () => {
      const { fetch } = createMockFetch({
        status: 404,
        json: { error: { message: "Model not found" } },
      });
      const client = makeClient(fetch);

      await expect(
        client.request("GET", "/v1/models/nonexistent"),
      ).rejects.toThrow(FerroNotFoundError);
    });

    it("throws FerroServerError on 500", async () => {
      const { fetch } = createMockFetch({
        status: 500,
        json: { error: { message: "Internal server error" } },
      });
      const client = makeClient(fetch);

      await expect(client.request("GET", "/v1/models")).rejects.toThrow(
        FerroServerError,
      );
    });

    it("throws FerroServerError on 502", async () => {
      const { fetch } = createMockFetch({
        status: 502,
        json: { error: { message: "Bad gateway" } },
      });
      const client = makeClient(fetch);

      await expect(client.request("GET", "/v1/models")).rejects.toThrow(
        FerroServerError,
      );
    });

    it("throws FerroAPIError with status and code for 400", async () => {
      const { fetch } = createMockFetch({
        status: 400,
        json: { error: { message: "Invalid model", code: "invalid_model" } },
      });
      const client = makeClient(fetch);

      try {
        await client.request("GET", "/v1/models");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(FerroAPIError);
        const apiErr = err as FerroAPIError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.code).toBe("invalid_model");
      }
    });

    it("parses error message from body.error.message", async () => {
      const { fetch } = createMockFetch({
        status: 400,
        json: { error: { message: "Model param is required" } },
      });
      const client = makeClient(fetch);

      try {
        await client.request("GET", "/v1/models");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect((err as FerroAPIError).message).toBe("Model param is required");
      }
    });

    it("extracts request_id from response headers", async () => {
      const { fetch } = createMockFetch({
        status: 400,
        json: { error: { message: "fail" } },
        headers: { "x-request-id": "req-header-id" },
      });
      const client = makeClient(fetch);

      try {
        await client.request("GET", "/v1/models");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect((err as FerroAPIError).requestId).toBe("req-header-id");
      }
    });

    it("carries the gateway error code on typed errors", async () => {
      const { fetch } = createMockFetch({
        status: 401,
        json: { error: { message: "bad", code: "invalid_api_key" } },
      });
      const client = makeClient(fetch);

      try {
        await client.request("GET", "/v1/models");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(FerroAuthError);
        expect((err as FerroAPIError).code).toBe("invalid_api_key");
      }
    });

    it("throws FerroBudgetExceededError on 402", async () => {
      const { fetch } = createMockFetch({
        status: 402,
        json: { error: { message: "budget", code: "insufficient_quota" } },
      });
      const client = makeClient(fetch);

      await expect(client.request("GET", "/v1/models")).rejects.toThrow(
        FerroBudgetExceededError,
      );
    });

    it("throws FerroPermissionError on 403", async () => {
      const { fetch } = createMockFetch({
        status: 403,
        json: { error: { message: "scope", code: "insufficient_scope" } },
      });
      const client = makeClient(fetch);

      try {
        await client.request("POST", "/admin/keys");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(FerroPermissionError);
        expect((err as FerroAPIError).code).toBe("insufficient_scope");
      }
    });

    it("exposes Retry-After on FerroRateLimitError", async () => {
      const { fetch } = createMockFetch({
        status: 429,
        json: { error: { message: "slow down" } },
        headers: { "retry-after": "7" },
      });
      const client = makeClient(fetch);

      try {
        await client.request("GET", "/v1/models");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect((err as FerroRateLimitError).retryAfter).toBe(7);
      }
    });

    it("accepts extra statuses via acceptStatus", async () => {
      const { fetch } = createMockFetch({
        status: 503,
        json: { status: "no_providers" },
      });
      const client = makeClient(fetch);

      const result = await client.request<{ status: string }>(
        "GET",
        "/health",
        { acceptStatus: [503] },
      );
      expect(result.status).toBe("no_providers");
    });

    it("HTTP errors are NOT retried", async () => {
      const { fetch } = createMockFetch({
        status: 500,
        json: { error: { message: "Internal error" } },
      });
      const client = makeClient(fetch, { maxRetries: 3 });

      await expect(client.request("GET", "/v1/models")).rejects.toThrow(
        FerroServerError,
      );
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("response metadata merging", () => {
    it("merges trace_id, provider and gateway_overhead_ms from gateway headers", async () => {
      const { fetch } = createMockFetch({
        json: {
          id: "chat-1",
          object: "chat.completion",
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        },
        headers: {
          "x-request-id": "85b1cf6b5b96f49d9c01966c056bfbc7",
          "x-gateway-provider": "anthropic",
          "x-gateway-overhead-ms": "31.062",
        },
      });
      const client = makeClient(fetch);

      const result = await client.request<{
        trace_id?: string;
        provider?: string;
        gateway_overhead_ms?: number;
      }>("POST", "/v1/chat/completions", { meta: true });

      expect(result.trace_id).toBe("85b1cf6b5b96f49d9c01966c056bfbc7");
      expect(result.provider).toBe("anthropic");
      expect(result.gateway_overhead_ms).toBeCloseTo(31.062);
    });

    it("body provider stays authoritative over the header", async () => {
      const { fetch } = createMockFetch({
        json: { id: "chat-1", provider: "openai" },
        headers: { "x-gateway-provider": "anthropic" },
      });
      const client = makeClient(fetch);

      const result = await client.request<{ provider?: string }>(
        "POST",
        "/v1/chat/completions",
        { meta: true },
      );
      expect(result.provider).toBe("openai");
    });

    it("does not merge without meta (catalog/admin bodies)", async () => {
      const { fetch } = createMockFetch({
        json: { object: "list", data: [] },
        headers: {
          "x-request-id": "abc",
          "x-gateway-provider": "openai",
        },
      });
      const client = makeClient(fetch);

      const result = await client.request<Record<string, unknown>>(
        "GET",
        "/v1/models",
      );
      expect(result).toEqual({ object: "list", data: [] });
    });

    it("ignores legacy x-ferro-* / x-trace-id headers", async () => {
      const { fetch } = createMockFetch({
        json: { id: "chat-1" },
        headers: {
          "x-trace-id": "legacy",
          "x-ferro-provider": "legacy",
          "x-ferro-latency-ms": "1",
          "x-ferro-cost-usd": "1",
        },
      });
      const client = makeClient(fetch);

      const result = await client.request<Record<string, unknown>>(
        "POST",
        "/v1/chat/completions",
        { meta: true },
      );
      expect(result).toEqual({ id: "chat-1" });
    });

    it("does not throw when response body is a non-object (array)", async () => {
      const { fetch } = createMockFetch({
        json: [1, 2, 3],
        headers: { "x-request-id": "abc" },
      });
      const client = makeClient(fetch);

      const result = await client.request<number[]>("GET", "/v1/models", {
        meta: true,
      });
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe("network errors and retries", () => {
    it("retries on network error up to maxRetries then throws FerroConnectionError", async () => {
      const networkError = new TypeError("fetch failed");
      const fetchFn = createErrorFetch(networkError);
      const client = makeClient(fetchFn, { maxRetries: 2 });

      await expect(client.request("GET", "/v1/models")).rejects.toThrow(
        FerroConnectionError,
      );
      // Initial attempt + 2 retries = 3 calls
      expect(fetchFn).toHaveBeenCalledTimes(3);
    });

    it("does not retry when maxRetries is 0", async () => {
      const networkError = new TypeError("fetch failed");
      const fetchFn = createErrorFetch(networkError);
      const client = makeClient(fetchFn, { maxRetries: 0 });

      await expect(client.request("GET", "/v1/models")).rejects.toThrow(
        FerroConnectionError,
      );
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });
  });
});
