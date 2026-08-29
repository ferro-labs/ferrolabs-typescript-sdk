import { describe, it, expect } from "vitest";
import { FerroClient } from "../src/client.js";
import { FerroServerError } from "../src/errors.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function makeClient(fetchFn: typeof globalThis.fetch) {
  return new FerroClient({ apiKey: "sk-test", fetch: fetchFn, maxRetries: 0 });
}

describe("health probes", () => {
  it("health() returns the JSON body on 200", async () => {
    const body = {
      status: "ok",
      version: "1.4.5",
      commit: "e8e4e26",
      built: "x",
      providers: [],
    };
    const { fetch, captured } = createMockFetch({ json: body });
    const client = makeClient(fetch);

    expect(await client.health()).toEqual(body);
    expect(captured[0]!.url).toMatch(/\/health$/);
    expect(captured[0]!.method).toBe("GET");
  });

  it("health() returns the JSON body on 503 instead of throwing", async () => {
    const { fetch } = createMockFetch({
      status: 503,
      json: { status: "no_providers" },
    });
    const client = makeClient(fetch);

    expect(await client.health()).toEqual({ status: "no_providers" });
  });

  it("ready() accepts 200 and 503", async () => {
    const notReady = { status: "not_ready", reason: "config not loaded" };
    const { fetch, captured } = createMockFetch({
      status: 503,
      json: notReady,
    });
    const client = makeClient(fetch);

    expect(await client.ready()).toEqual(notReady);
    expect(captured[0]!.url).toMatch(/\/readyz$/);
  });

  it("live() hits /livez", async () => {
    const { fetch, captured } = createMockFetch({ json: { status: "ok" } });
    const client = makeClient(fetch);

    expect(await client.live()).toEqual({ status: "ok" });
    expect(captured[0]!.url).toMatch(/\/livez$/);
  });

  it("health() still throws on other errors", async () => {
    const { fetch } = createMockFetch({
      status: 500,
      json: { error: { message: "x" } },
    });
    const client = makeClient(fetch);

    await expect(client.health()).rejects.toThrow(FerroServerError);
  });
});

describe("capabilities", () => {
  it("returns the provider matrix from GET /v1/capabilities", async () => {
    const body = {
      providers: { openai: { seed: "forward", n: "unsupported" } },
      image_response_formats: { openai: ["url", "b64_json"] },
    };
    const { fetch, captured } = createMockFetch({ json: body });
    const client = makeClient(fetch);

    expect(await client.capabilities()).toEqual(body);
    expect(captured[0]!.url).toMatch(/\/v1\/capabilities$/);
  });
});

describe("rerank", () => {
  it("POSTs the Cohere v2 shape and merges metadata", async () => {
    const body = { results: [{ index: 1, relevance_score: 0.9 }] };
    const { fetch, captured } = createMockFetch({
      json: body,
      headers: { "x-request-id": "abc", "x-gateway-provider": "cohere" },
    });
    const client = makeClient(fetch);

    const result = await client.rerank({
      model: "rerank-v3.5",
      query: "q",
      documents: ["a", "b"],
      top_n: 1,
    });

    expect(result.results).toEqual(body.results);
    expect(result.trace_id).toBe("abc");
    expect(result.provider).toBe("cohere");
    expect(captured[0]!.method).toBe("POST");
    expect(captured[0]!.url).toMatch(/\/v1\/rerank$/);
    expect(captured[0]!.body).toEqual({
      model: "rerank-v3.5",
      query: "q",
      documents: ["a", "b"],
      top_n: 1,
    });
  });
});

describe("moderations", () => {
  it("POSTs /v1/moderations with the required model", async () => {
    const body = { id: "m", model: "omni-moderation-latest", results: [] };
    const { fetch, captured } = createMockFetch({
      json: body,
      headers: { "x-request-id": "abc" },
    });
    const client = makeClient(fetch);

    const result = await client.moderations.create({
      input: "hi",
      model: "omni-moderation-latest",
    });
    expect(result.id).toBe("m");
    expect(result.trace_id).toBe("abc");
    expect(captured[0]!.url).toMatch(/\/v1\/moderations$/);
    expect(captured[0]!.body).toEqual({
      input: "hi",
      model: "omni-moderation-latest",
    });
  });
});

describe("responses", () => {
  const response = {
    id: "resp_1",
    object: "response",
    created_at: 1,
    status: "completed",
    model: "gpt-4o-mini",
    output: [{ type: "message" }],
  };

  it("create() POSTs /v1/responses and merges provider from the header", async () => {
    const { fetch, captured } = createMockFetch({
      json: response,
      headers: { "x-request-id": "abc", "x-gateway-provider": "openai" },
    });
    const client = makeClient(fetch);

    const result = await client.responses.create({
      model: "gpt-4o-mini",
      input: "hi",
    });
    expect(result.id).toBe("resp_1");
    expect(result.provider).toBe("openai");
    expect(result.trace_id).toBe("abc");
    expect(captured[0]!.method).toBe("POST");
    expect(captured[0]!.url).toMatch(/\/v1\/responses$/);
    expect(captured[0]!.body).toEqual({ model: "gpt-4o-mini", input: "hi" });
  });

  it("retrieve() GETs /v1/responses/{id}", async () => {
    const { fetch, captured } = createMockFetch({ json: response });
    const client = makeClient(fetch);

    expect(await client.responses.retrieve("resp/1")).toEqual(response);
    expect(captured[0]!.method).toBe("GET");
    expect(captured[0]!.url).toMatch(/\/v1\/responses\/resp%2F1$/);
  });

  it("delete() DELETEs /v1/responses/{id}", async () => {
    const { fetch, captured } = createMockFetch({
      json: { id: "resp_1", deleted: true },
    });
    const client = makeClient(fetch);

    expect(await client.responses.delete("resp_1")).toEqual({
      id: "resp_1",
      deleted: true,
    });
    expect(captured[0]!.method).toBe("DELETE");
    expect(captured[0]!.url).toMatch(/\/v1\/responses\/resp_1$/);
  });
});
