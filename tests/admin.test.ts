import { describe, it, expect } from "vitest";
import { FerroClient } from "../src/client.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function makeClient(fetchFn: typeof globalThis.fetch) {
  return new FerroClient({ apiKey: "sk-test", fetch: fetchFn });
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

describe("Admin Keys", () => {
  const MOCK_KEY = {
    id: "key-1",
    name: "Test Key",
    key: "sk-abc123",
    scopes: ["read", "write"],
    active: true,
    created_at: "2024-01-01T00:00:00Z",
    expires_at: null,
    last_used_at: null,
    usage_count: 0,
    revoked_at: null,
    rotated_at: null,
  };

  describe("list", () => {
    it("returns keys from { data: [...] } shape", async () => {
      const { fetch } = createMockFetch({ json: { data: [MOCK_KEY] } });
      const client = makeClient(fetch);

      const result = await client.admin.keys.list();
      expect(result).toEqual([MOCK_KEY]);
    });

    it("returns keys from { keys: [...] } shape", async () => {
      const { fetch } = createMockFetch({ json: { keys: [MOCK_KEY] } });
      const client = makeClient(fetch);

      const result = await client.admin.keys.list();
      expect(result).toEqual([MOCK_KEY]);
    });

    it("returns keys from raw array shape", async () => {
      const { fetch } = createMockFetch({ json: [MOCK_KEY] });
      const client = makeClient(fetch);

      const result = await client.admin.keys.list();
      expect(result).toEqual([MOCK_KEY]);
    });

    it("calls GET /admin/keys", async () => {
      const { fetch, captured } = createMockFetch({ json: { data: [] } });
      const client = makeClient(fetch);

      await client.admin.keys.list();
      expect(captured[0]!.method).toBe("GET");
      expect(captured[0]!.url).toContain("/admin/keys");
    });
  });

  describe("create", () => {
    it("sends correct body and returns created key", async () => {
      const createdKey = {
        id: "key-2",
        name: "New Key",
        key: "sk-new-key",
        scopes: ["read"],
        active: true,
        created_at: "2024-01-02T00:00:00Z",
        expires_at: null,
      };
      const { fetch, captured } = createMockFetch({ json: createdKey });
      const client = makeClient(fetch);

      const result = await client.admin.keys.create({
        name: "New Key",
        scopes: ["read"],
      });

      expect(result).toEqual(createdKey);
      expect(captured[0]!.method).toBe("POST");
      expect(captured[0]!.url).toContain("/admin/keys");
      expect(captured[0]!.body).toEqual({ name: "New Key", scopes: ["read"] });
    });
  });

  describe("revoke", () => {
    it("calls POST /admin/keys/:id/revoke", async () => {
      const { fetch, captured } = createMockFetch({ status: 204 });
      const client = makeClient(fetch);

      await client.admin.keys.revoke("key-1");
      expect(captured[0]!.method).toBe("POST");
      expect(captured[0]!.url).toContain("/admin/keys/key-1/revoke");
    });
  });

  describe("rotate", () => {
    it("calls POST /admin/keys/:id/rotate and returns new key", async () => {
      const rotatedKey = {
        id: "key-1",
        name: "Test Key",
        key: "sk-rotated",
        scopes: ["read"],
        active: true,
        created_at: "2024-01-01T00:00:00Z",
        expires_at: null,
      };
      const { fetch, captured } = createMockFetch({ json: rotatedKey });
      const client = makeClient(fetch);

      const result = await client.admin.keys.rotate("key-1");
      expect(result).toEqual(rotatedKey);
      expect(captured[0]!.method).toBe("POST");
      expect(captured[0]!.url).toContain("/admin/keys/key-1/rotate");
    });
  });

  describe("delete", () => {
    it("calls DELETE /admin/keys/:id", async () => {
      const { fetch, captured } = createMockFetch({ status: 204 });
      const client = makeClient(fetch);

      await client.admin.keys.delete("key-1");
      expect(captured[0]!.method).toBe("DELETE");
      expect(captured[0]!.url).toContain("/admin/keys/key-1");
    });
  });

  describe("retrieve", () => {
    it("calls GET /admin/keys/:id", async () => {
      const { fetch, captured } = createMockFetch({ json: MOCK_KEY });
      const client = makeClient(fetch);

      const result = await client.admin.keys.retrieve("key-1");
      expect(result).toEqual(MOCK_KEY);
      expect(captured[0]!.method).toBe("GET");
      expect(captured[0]!.url).toContain("/admin/keys/key-1");
    });
  });

  describe("update", () => {
    it("calls PUT /admin/keys/:id with body", async () => {
      const updatedKey = { ...MOCK_KEY, name: "Updated" };
      const { fetch, captured } = createMockFetch({ json: updatedKey });
      const client = makeClient(fetch);

      const result = await client.admin.keys.update("key-1", { name: "Updated" });
      expect(result).toEqual(updatedKey);
      expect(captured[0]!.method).toBe("PUT");
      expect(captured[0]!.url).toContain("/admin/keys/key-1");
      expect(captured[0]!.body).toEqual({ name: "Updated" });
    });
  });

  describe("usage", () => {
    it("calls GET /admin/keys/usage", async () => {
      const mockUsage = { total_requests: 100, total_tokens: 5000 };
      const { fetch, captured } = createMockFetch({ json: mockUsage });
      const client = makeClient(fetch);

      const result = await client.admin.keys.usage();
      expect(result).toEqual(mockUsage);
      expect(captured[0]!.method).toBe("GET");
      expect(captured[0]!.url).toContain("/admin/keys/usage");
    });

    it("sends query params", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      await client.admin.keys.usage({
        limit: 10,
        offset: 5,
        sort: "usage",
        active: true,
        since: "2024-01-01",
      });

      const url = captured[0]!.url;
      expect(url).toContain("limit=10");
      expect(url).toContain("offset=5");
      expect(url).toContain("sort=usage");
      expect(url).toContain("active=true");
      expect(url).toContain("since=2024-01-01");
    });
  });
});

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

describe("Admin Config", () => {
  describe("get", () => {
    it("parses GatewayConfig shape", async () => {
      const rawConfig = {
        strategy: { type: "round_robin" },
        targets: [{ provider: "openai" }],
        plugins: [{ name: "cache" }],
        aliases: { "gpt-4": "openai/gpt-4-turbo" },
        extra_field: "value",
      };
      const { fetch } = createMockFetch({ json: rawConfig });
      const client = makeClient(fetch);

      const result = await client.admin.config.get();
      expect(result.strategy).toEqual({ type: "round_robin" });
      expect(result.targets).toEqual([{ provider: "openai" }]);
      expect(result.plugins).toEqual([{ name: "cache" }]);
      expect(result.aliases).toEqual({ "gpt-4": "openai/gpt-4-turbo" });
      expect(result.raw).toEqual(rawConfig);
    });

    it("defaults missing fields to empty", async () => {
      const { fetch } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      const result = await client.admin.config.get();
      expect(result.strategy).toEqual({});
      expect(result.targets).toEqual([]);
      expect(result.plugins).toEqual([]);
      expect(result.aliases).toEqual({});
    });

    it("calls GET /admin/config", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      await client.admin.config.get();
      expect(captured[0]!.method).toBe("GET");
      expect(captured[0]!.url).toContain("/admin/config");
    });
  });

  describe("update", () => {
    it("calls PUT /admin/config with body", async () => {
      const newConfig = { strategy: { type: "fallback" } };
      const { fetch, captured } = createMockFetch({ json: { success: true } });
      const client = makeClient(fetch);

      await client.admin.config.update(newConfig);
      expect(captured[0]!.method).toBe("PUT");
      expect(captured[0]!.url).toContain("/admin/config");
      expect(captured[0]!.body).toEqual(newConfig);
    });
  });

  describe("create", () => {
    it("calls POST /admin/config with body", async () => {
      const newConfig = { strategy: { type: "weighted" } };
      const { fetch, captured } = createMockFetch({ json: { success: true } });
      const client = makeClient(fetch);

      await client.admin.config.create(newConfig);
      expect(captured[0]!.method).toBe("POST");
      expect(captured[0]!.url).toContain("/admin/config");
      expect(captured[0]!.body).toEqual(newConfig);
    });
  });

  describe("delete", () => {
    it("calls DELETE /admin/config", async () => {
      const { fetch, captured } = createMockFetch({ json: { deleted: true } });
      const client = makeClient(fetch);

      await client.admin.config.delete();
      expect(captured[0]!.method).toBe("DELETE");
      expect(captured[0]!.url).toContain("/admin/config");
    });
  });

  describe("history", () => {
    it("returns config history from { data: [...] } shape", async () => {
      const entries = [
        { version: 1, config: {}, updated_at: "2024-01-01T00:00:00Z" },
        { version: 2, config: {}, updated_at: "2024-01-02T00:00:00Z" },
      ];
      const { fetch } = createMockFetch({ json: { data: entries } });
      const client = makeClient(fetch);

      const result = await client.admin.config.history();
      expect(result).toEqual(entries);
    });

    it("returns config history from raw array shape", async () => {
      const entries = [
        { version: 1, config: {}, updated_at: "2024-01-01T00:00:00Z" },
      ];
      const { fetch } = createMockFetch({ json: entries });
      const client = makeClient(fetch);

      const result = await client.admin.config.history();
      expect(result).toEqual(entries);
    });

    it("calls GET /admin/config/history", async () => {
      const { fetch, captured } = createMockFetch({ json: [] });
      const client = makeClient(fetch);

      await client.admin.config.history();
      expect(captured[0]!.method).toBe("GET");
      expect(captured[0]!.url).toContain("/admin/config/history");
    });
  });

  describe("rollback", () => {
    it("calls POST /admin/config/rollback/:version", async () => {
      const { fetch, captured } = createMockFetch({ json: { rolled_back: true } });
      const client = makeClient(fetch);

      await client.admin.config.rollback(3);
      expect(captured[0]!.method).toBe("POST");
      expect(captured[0]!.url).toContain("/admin/config/rollback/3");
    });
  });
});

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

describe("Admin Logs", () => {
  describe("list", () => {
    it("calls GET /admin/logs", async () => {
      const mockLogs = { data: [], total: 0 };
      const { fetch, captured } = createMockFetch({ json: mockLogs });
      const client = makeClient(fetch);

      const result = await client.admin.logs.list();
      expect(result).toEqual(mockLogs);
      expect(captured[0]!.method).toBe("GET");
      expect(captured[0]!.url).toContain("/admin/logs");
    });

    it("sends filter query params", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      await client.admin.logs.list({
        limit: 50,
        offset: 10,
        stage: "production",
        provider: "anthropic",
        model: "claude-3-opus",
        since: "2024-01-01",
      });

      const url = captured[0]!.url;
      expect(url).toContain("limit=50");
      expect(url).toContain("offset=10");
      expect(url).toContain("stage=production");
      expect(url).toContain("provider=anthropic");
      expect(url).toContain("model=claude-3-opus");
      expect(url).toContain("since=2024-01-01");
    });

    it("omits undefined params", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      await client.admin.logs.list({ limit: 10 });

      const url = captured[0]!.url;
      expect(url).toContain("limit=10");
      expect(url).not.toContain("offset=");
      expect(url).not.toContain("stage=");
      expect(url).not.toContain("provider=");
    });
  });

  describe("stats", () => {
    it("calls GET /admin/logs/stats", async () => {
      const mockStats = { total_requests: 500, avg_latency_ms: 120 };
      const { fetch, captured } = createMockFetch({ json: mockStats });
      const client = makeClient(fetch);

      const result = await client.admin.logs.stats();
      expect(result).toEqual(mockStats);
      expect(captured[0]!.method).toBe("GET");
      expect(captured[0]!.url).toContain("/admin/logs/stats");
    });

    it("sends filter query params", async () => {
      const { fetch, captured } = createMockFetch({ json: {} });
      const client = makeClient(fetch);

      await client.admin.logs.stats({
        limit: 100,
        since: "2024-01-01",
        stage: "staging",
        provider: "openai",
        model: "gpt-4",
      });

      const url = captured[0]!.url;
      expect(url).toContain("limit=100");
      expect(url).toContain("since=2024-01-01");
      expect(url).toContain("stage=staging");
      expect(url).toContain("provider=openai");
      expect(url).toContain("model=gpt-4");
    });
  });

  describe("delete", () => {
    it("calls DELETE /admin/logs", async () => {
      const { fetch, captured } = createMockFetch({ json: { deleted: 50 } });
      const client = makeClient(fetch);

      const result = await client.admin.logs.delete();
      expect(result).toEqual({ deleted: 50 });
      expect(captured[0]!.method).toBe("DELETE");
      expect(captured[0]!.url).toContain("/admin/logs");
    });

    it("sends filter query params", async () => {
      const { fetch, captured } = createMockFetch({ json: { deleted: 10 } });
      const client = makeClient(fetch);

      await client.admin.logs.delete({
        before: "2024-01-01",
        stage: "test",
        provider: "openai",
        model: "gpt-3.5-turbo",
      });

      const url = captured[0]!.url;
      expect(url).toContain("before=2024-01-01");
      expect(url).toContain("stage=test");
      expect(url).toContain("provider=openai");
      expect(url).toContain("model=gpt-3.5-turbo");
    });
  });
});

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

describe("Admin Providers", () => {
  describe("list", () => {
    it("returns providers from { data: [...] } shape", async () => {
      const providers = [{ name: "openai" }, { name: "anthropic" }];
      const { fetch } = createMockFetch({ json: { data: providers } });
      const client = makeClient(fetch);

      const result = await client.admin.providers.list();
      expect(result).toEqual(providers);
    });

    it("returns providers from raw array shape", async () => {
      const providers = [{ name: "openai" }];
      const { fetch } = createMockFetch({ json: providers });
      const client = makeClient(fetch);

      const result = await client.admin.providers.list();
      expect(result).toEqual(providers);
    });

    it("calls GET /admin/providers", async () => {
      const { fetch, captured } = createMockFetch({ json: [] });
      const client = makeClient(fetch);

      await client.admin.providers.list();
      expect(captured[0]!.method).toBe("GET");
      expect(captured[0]!.url).toContain("/admin/providers");
    });
  });
});

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

describe("Admin Plugins", () => {
  describe("list", () => {
    it("returns plugins from { data: [...] } shape", async () => {
      const plugins = [{ name: "cache" }, { name: "rate-limit" }];
      const { fetch } = createMockFetch({ json: { data: plugins } });
      const client = makeClient(fetch);

      const result = await client.admin.plugins.list();
      expect(result).toEqual(plugins);
    });

    it("returns plugins from raw array shape", async () => {
      const plugins = [{ name: "cache" }];
      const { fetch } = createMockFetch({ json: plugins });
      const client = makeClient(fetch);

      const result = await client.admin.plugins.list();
      expect(result).toEqual(plugins);
    });

    it("calls GET /admin/plugins", async () => {
      const { fetch, captured } = createMockFetch({ json: [] });
      const client = makeClient(fetch);

      await client.admin.plugins.list();
      expect(captured[0]!.method).toBe("GET");
      expect(captured[0]!.url).toContain("/admin/plugins");
    });
  });
});

// ---------------------------------------------------------------------------
// Dashboard & Health
// ---------------------------------------------------------------------------

describe("Admin Dashboard", () => {
  it("calls GET /admin/dashboard", async () => {
    const dashData = { requests_today: 1000, active_keys: 5 };
    const { fetch, captured } = createMockFetch({ json: dashData });
    const client = makeClient(fetch);

    const result = await client.admin.dashboard();
    expect(result).toEqual(dashData);
    expect(captured[0]!.method).toBe("GET");
    expect(captured[0]!.url).toContain("/admin/dashboard");
  });
});

describe("Admin Health", () => {
  it("calls GET /admin/health", async () => {
    const healthData = { status: "healthy", uptime_seconds: 86400 };
    const { fetch, captured } = createMockFetch({ json: healthData });
    const client = makeClient(fetch);

    const result = await client.admin.health();
    expect(result).toEqual(healthData);
    expect(captured[0]!.method).toBe("GET");
    expect(captured[0]!.url).toContain("/admin/health");
  });
});
