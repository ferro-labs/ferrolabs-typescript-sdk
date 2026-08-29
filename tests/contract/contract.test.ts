/**
 * Contract suite — runs against a REAL ai-gateway (see scripts/with-gateway.sh).
 *
 * Every field the README "Observability" table names is asserted non-empty
 * here. If this file goes red on the pinned gateway ref, the SDK has drifted.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { FerroClient } from "../../src/client.js";
import {
  FerroAuthError,
  FerroNotFoundError,
  FerroPermissionError,
  FerroServerError,
} from "../../src/errors.js";
import type { ChatCompletionChunk } from "../../src/types.js";

const baseUrl = process.env["FERRO_CONTRACT_BASE_URL"];
const masterKey = process.env["FERRO_CONTRACT_MASTER_KEY"];
const stubUrl = process.env["FERRO_CONTRACT_STUB_URL"];

if (!baseUrl || !masterKey || !stubUrl) {
  throw new Error(
    "contract suite needs FERRO_CONTRACT_BASE_URL, FERRO_CONTRACT_MASTER_KEY and FERRO_CONTRACT_STUB_URL — run scripts/with-gateway.sh",
  );
}

const TRACE_ID = /^[0-9a-f]{32}$/;
const MODEL = "gpt-4o-mini";

const client = new FerroClient({ apiKey: masterKey, baseUrl, maxRetries: 0 });

async function stubRequests(): Promise<{ method: string; path: string }[]> {
  const res = await fetch(`${stubUrl}/_requests`);
  return (await res.json()) as { method: string; path: string }[];
}

describe("probes", () => {
  it("health() reports version/commit/built and providers", async () => {
    const h = await client.health();
    expect(h.status).toBe("ok");
    expect(typeof h.version).toBe("string");
    expect(typeof h.commit).toBe("string");
    expect(typeof h.built).toBe("string");
    expect(h.providers?.map((p) => p.name)).toContain("openai");
  });

  it("ready() reports providers and targets", async () => {
    const r = await client.ready();
    expect(r.status).toBe("ready");
    expect(r.providers?.[0]).toMatchObject({
      name: "openai",
      circuit: "closed",
    });
    expect(r.targets?.[0]).toMatchObject({ name: "openai", routable: true });
  });

  it("live() answers ok", async () => {
    expect(await client.live()).toEqual({ status: "ok" });
  });

  it("capabilities() lists the configured provider's parameter matrix", async () => {
    const caps = await client.capabilities();
    expect(caps.providers["openai"]).toBeDefined();
    expect(Object.values(caps.providers["openai"]!)).toContain("forward");
    expect(caps.image_response_formats).toBeDefined();
  });
});

describe("models", () => {
  it("list() returns EnrichedModelInfo entries", async () => {
    const models = await client.models.list();
    expect(models.length).toBeGreaterThan(10);
    const m = models.find((x) => x.id === MODEL);
    expect(m).toMatchObject({ id: MODEL, object: "model", owned_by: "openai" });
    expect(typeof m!.created).toBe("number");
    expect(m!.mode).toBe("chat");
    expect(m!.capabilities).toContain("streaming");
  });

  it("list({provider, capability}) filters client-side", async () => {
    const vision = await client.models.list({
      provider: "openai",
      capability: "vision",
    });
    expect(vision.length).toBeGreaterThan(0);
    expect(
      vision.every(
        (m) => m.owned_by === "openai" && m.capabilities?.includes("vision"),
      ),
    ).toBe(true);
    expect(await client.models.list({ provider: "anthropic" })).toEqual([]);
  });

  it("retrieve() never reaches the upstream and 404s locally", async () => {
    const before = (await stubRequests()).length;
    expect((await client.models.retrieve(MODEL)).id).toBe(MODEL);
    await expect(client.models.retrieve("no-such-model")).rejects.toThrow(
      FerroNotFoundError,
    );
    const after = await stubRequests();
    expect(after.length).toBe(before);
    expect(after.some((r) => r.path.startsWith("/v1/models/"))).toBe(false);
  });

  it("search() is a substring match on id", async () => {
    const hits = await client.models.search("EMBEDDING");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((m) => m.id.includes("embedding"))).toBe(true);
  });
});

describe("chat completions", () => {
  it("non-streaming carries trace_id, provider, gateway_overhead_ms and usage", async () => {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "hi" }],
      max_completion_tokens: 8,
    });
    expect(res.choices[0]?.message.content).toBe("stub reply");
    expect(res.trace_id).toMatch(TRACE_ID);
    expect(res.provider).toBe("openai");
    expect(typeof res.gateway_overhead_ms).toBe("number");
    expect(res.usage).toMatchObject({
      prompt_tokens: 3,
      completion_tokens: 2,
      total_tokens: 5,
    });
  });

  it("forwards max_completion_tokens to the upstream", async () => {
    const last = (await stubRequests()).at(-1) as {
      body?: Record<string, unknown>;
    };
    expect(last.body?.["max_completion_tokens"]).toBe(8);
  });

  it("streaming yields chunks, a terminal usage chunk, and trace_id on the Stream", async () => {
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "hi" }],
      stream: true,
      stream_options: { include_usage: true },
    });
    expect(stream.trace_id).toMatch(TRACE_ID);

    const chunks: ChatCompletionChunk[] = [];
    for await (const c of stream) chunks.push(c);

    const text = chunks.map((c) => c.choices[0]?.delta.content ?? "").join("");
    expect(text).toBe("stub stream reply");
    expect(chunks.every((c) => c.trace_id === stream.trace_id)).toBe(true);
    expect(chunks.at(-1)?.usage).toMatchObject({ total_tokens: 6 });
  });

  it("abort() mid-stream resolves cleanly", async () => {
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: "hi" }],
      stream: true,
    });
    let seen = 0;
    for await (const _ of stream) {
      void _;
      seen++;
      stream.abort();
    }
    expect(seen).toBe(1);
  });

  it("embeddings carry trace_id", async () => {
    const res = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: "hi",
    });
    expect(res.data[0]?.embedding.length).toBe(3);
    expect(res.trace_id).toMatch(TRACE_ID);
  });
});

describe("responses API", () => {
  it("create() routes by model and merges provider from X-Gateway-Provider", async () => {
    const res = await client.responses.create({ model: MODEL, input: "hi" });
    expect(res.object).toBe("response");
    expect(res.provider).toBe("openai");
    expect(res.trace_id).toMatch(TRACE_ID);
  });

  it("retrieve() is 501 responses_not_configured without responses_target", async () => {
    try {
      await client.responses.retrieve("resp_123");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FerroServerError);
      expect((err as FerroServerError).status).toBe(501);
      expect((err as FerroServerError).code).toBe("responses_not_configured");
    }
  });
});

describe("error envelope", () => {
  it("401 -> FerroAuthError with the gateway code", async () => {
    const bad = new FerroClient({ apiKey: "fgw_nope", baseUrl, maxRetries: 0 });
    try {
      await bad.models.list();
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FerroAuthError);
      expect((err as FerroAuthError).code).toBe("invalid_api_key");
      expect((err as FerroAuthError).requestId).toMatch(TRACE_ID);
    }
  });

  it("404 unknown model -> FerroNotFoundError(model_not_found)", async () => {
    try {
      await client.chat.completions.create({
        model: "no-such-model",
        messages: [{ role: "user", content: "hi" }],
      });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FerroNotFoundError);
      expect((err as FerroNotFoundError).code).toBe("model_not_found");
    }
  });

  it("rerank with no serving provider -> FerroNotFoundError", async () => {
    await expect(
      client.rerank({ model: "rerank-v3.5", query: "q", documents: ["a"] }),
    ).rejects.toThrow(FerroNotFoundError);
  });

  it("wrong scope -> FerroPermissionError(insufficient_scope)", async () => {
    const ro = await client.admin.keys.create({
      name: "contract-ro",
      scopes: ["read_only"],
    });
    const limited = new FerroClient({ apiKey: ro.key, baseUrl, maxRetries: 0 });
    try {
      expect((await limited.admin.keys.list()).length).toBeGreaterThan(0);
      await limited.admin.keys.create({ name: "escalate" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FerroPermissionError);
      expect((err as FerroPermissionError).code).toBe("insufficient_scope");
    } finally {
      await client.admin.keys.delete(ro.id);
    }
  });
});

describe("admin", () => {
  let keyId: string;

  beforeAll(async () => {
    // The gateway refuses to revoke/delete the last stored admin key (the
    // MASTER_KEY does not count), so keep one around for the lifecycle test.
    await client.admin.keys.create({
      name: "contract-keeper",
      scopes: ["admin"],
    });
    keyId = (
      await client.admin.keys.create({ name: "contract", scopes: ["admin"] })
    ).id;
  });

  it("keys: retrieve/update/revoke/rotate/delete", async () => {
    expect((await client.admin.keys.retrieve(keyId)).name).toBe("contract");
    expect(
      (await client.admin.keys.update(keyId, { name: "contract-2" })).name,
    ).toBe("contract-2");
    const rotated = await client.admin.keys.rotate(keyId);
    expect(rotated.key).toMatch(/^fgw_/);
    await client.admin.keys.revoke(keyId);
    expect((await client.admin.keys.retrieve(keyId)).active).toBe(false);
    await client.admin.keys.delete(keyId);
    await expect(client.admin.keys.retrieve(keyId)).rejects.toThrow(
      FerroNotFoundError,
    );
  });

  it("config.get() exposes strategy and targets", async () => {
    const cfg = await client.admin.config.get();
    expect(cfg.strategy).toEqual({ mode: "single" });
    expect(cfg.targets[0]).toMatchObject({ virtual_key: "openai" });
  });

  it("logs.list()/stats() return persisted rows", async () => {
    const logs = await client.admin.logs.list({ limit: 5, stage: "all" });
    expect((logs["data"] as unknown[]).length).toBeGreaterThan(0);
    const stats = await client.admin.logs.stats({ buckets: 3 });
    expect(stats["by_provider"]).toHaveProperty("openai");
  });

  it("providers.list()/catalog()", async () => {
    expect((await client.admin.providers.list())[0]).toMatchObject({
      name: "openai",
    });
    const catalog = await client.admin.providers.catalog();
    expect(catalog.find((p) => p.id === "openai")).toMatchObject({
      registered: true,
    });
    expect(catalog.length).toBeGreaterThan(20);
  });

  it("plugins.list()/catalog()", async () => {
    expect((await client.admin.plugins.list())[0]).toMatchObject({
      name: "request-logger",
    });
    const catalog = await client.admin.plugins.catalog();
    expect(catalog.map((p) => p.name)).toContain("request-logger");
  });

  it("audit.list() records the key operations above", async () => {
    const audit = await client.admin.audit.list({
      action: "key.create",
      limit: 10,
    });
    expect(audit.summary.total_entries).toBeGreaterThan(0);
    expect(audit.data[0]).toMatchObject({
      action: "key.create",
      outcome: "ok",
    });
    expect(audit.data[0]?.trace_id).toMatch(TRACE_ID);
  });

  it("dashboard()/health()", async () => {
    expect(await client.admin.dashboard()).toHaveProperty("request_logs");
    expect((await client.admin.health())["status"]).toBeDefined();
  });
});
