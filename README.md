<div align="center">
  <table border="0" cellspacing="0" cellpadding="0"><tr>
    <td rowspan="2"><img src="https://raw.githubusercontent.com/ferro-labs/ai-gateway/refs/heads/main/docs/logo.png" alt="Ferro Labs" width="64" /></td>
    <td align="center"><h1>Ferro Labs - AI Gateway</h1></td>
  </tr><tr>
    <td align="center"><strong>TypeScript SDK</strong></td>
  </tr></table>
  <p>
    <a href="https://www.npmjs.com/package/@ferro-labs-ai/sdk"><img src="https://img.shields.io/npm/v/@ferro-labs-ai/sdk.svg" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@ferro-labs-ai/sdk"><img src="https://img.shields.io/node/v/@ferro-labs-ai/sdk.svg" alt="Node version" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License" /></a>
    <a href="https://github.com/ferro-labs/ferrolabs-typescript-sdk/actions/workflows/ci.yml"><img src="https://github.com/ferro-labs/ferrolabs-typescript-sdk/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
    <a href="https://www.npmjs.com/package/@ferro-labs-ai/sdk"><img src="https://img.shields.io/npm/dm/@ferro-labs-ai/sdk.svg" alt="Downloads" /></a>
    <a href="https://www.npmjs.com/package/@ferro-labs-ai/sdk"><img src="https://img.shields.io/npm/types/@ferro-labs-ai/sdk.svg" alt="TypeScript" /></a>
  </p>
</div>

Route LLM requests across **30 providers and 2,500+ models** through a single OpenAI-compatible API.
Zero code changes to migrate from `openai`. Built on [Ferro Labs AI Gateway](https://github.com/ferro-labs/ai-gateway).

```typescript
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient({ apiKey: "sk-ferro-..." });

// Route to OpenAI
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

// Route to Anthropic — same client, same call
const response2 = await client.chat.completions.create({
  model: "claude-3-5-sonnet-20241022",
  messages: [{ role: "user", content: "Hello" }],
});

console.log(response.choices[0]?.message.content);
console.log(`Handled by ${response.provider}, trace ${response.trace_id}`);
```

---

## Why Ferro Labs SDK

- **One API for 30 providers.** OpenAI, Anthropic, Google, Groq, Together, Mistral, Cohere, Bedrock, Vertex, Azure, and more — all via a single client.
- **Drop-in OpenAI replacement.** The surface matches the OpenAI SDK. Change two lines and keep all your existing code.
- **Smart routing built in.** Fallback chains, weighted load balancing, conditional and cost-optimised routing — configured on the gateway, transparent to the caller.
- **Provider and trace visibility.** Every inference response carries `provider` and a `trace_id` that matches the gateway's logs and OTel traces — no extra calls.
- **Self-hostable.** Point `baseUrl` at any [Ferro Labs AI Gateway](https://github.com/ferro-labs/ai-gateway) instance and go.
- **TypeScript-first.** Full type inference, strict mode, zero runtime dependencies, ESM + CJS dual output.

---

## Contents

- [Installation](#installation)
- [Quickstart](#quickstart)
- [Migrate from OpenAI](#migrate-from-openai)
- [Framework integrations](#framework-integrations)
- [Usage](#usage)
  - [Chat completions](#chat-completions)
  - [Streaming](#streaming)
  - [Embeddings](#embeddings)
  - [Image generation](#image-generation)
  - [Model catalog](#model-catalog)
  - [Responses API](#responses-api)
  - [Rerank and moderations](#rerank-and-moderations)
  - [Health and capabilities](#health-and-capabilities)
- [Observability](#observability)
- [Configuration](#configuration)
- [Error handling](#error-handling)
- [Admin API (OSS gateway)](#admin-api-oss-gateway)
- [Examples](#examples)
- [Development](#development)
- [License](#license)

---

## Installation

```bash
npm install @ferro-labs-ai/sdk
```

```bash
pnpm add @ferro-labs-ai/sdk
```

```bash
yarn add @ferro-labs-ai/sdk
```

Requires **Node.js 20+** (also works in Bun, Deno, and modern browsers). **Zero runtime dependencies** — uses native `fetch`.

**Compatibility:** `@ferro-labs-ai/sdk 0.3.x` ↔ `ai-gateway ≥ v1.4.0`. Every release is verified against the pinned gateway by the [contract suite](#development).

---

## Quickstart

You'll need a running [Ferro Labs AI Gateway](https://github.com/ferro-labs/ai-gateway) instance and an API key issued by it.

```typescript
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient({
  apiKey: "sk-ferro-your-key",
  baseUrl: "http://localhost:8080", // your gateway address
});
```

### Environment variables

```bash
export FERRO_API_KEY="sk-ferro-your-key"
export FERRO_BASE_URL="http://localhost:8080"
```

```typescript
const client = new FerroClient(); // reads FERRO_API_KEY / FERRO_BASE_URL automatically
```

`FERRO_API_KEY` takes precedence, but `OPENAI_API_KEY` is also accepted as a fallback to make migration painless.

---

## Migrate from OpenAI

```typescript
// Before
import OpenAI from "openai";
const client = new OpenAI({ apiKey: "sk-openai-..." });

// After — all your existing code works unchanged
import { FerroClient } from "@ferro-labs-ai/sdk";
const client = new FerroClient({ apiKey: "sk-ferro-..." });
```

Every `client.chat.completions.create(...)` call, every streaming loop, every tool call — identical API surface. Ferro routes to the right provider based on the model name.

---

## Framework integrations

Ferro's gateway exposes an OpenAI-compatible HTTP API at `/v1/*`, so anything that speaks OpenAI works. Point the base URL at your gateway and keep your existing framework.

### Vercel AI SDK

```typescript
import { createOpenAI } from "@ai-sdk/openai";

const ferro = createOpenAI({
  apiKey: process.env.FERRO_API_KEY,
  baseURL: "http://localhost:8080/v1",
});
```

### LangChain.js

The SDK ships a native `FerroChatModel` via the `@ferro-labs-ai/sdk/langchain`
sub-export. It surfaces gateway metadata (`trace_id`, `provider`,
`gateway_overhead_ms`) in `response_metadata` — the canonical join key for
observability bridges — which the generic `ChatOpenAI` adapter cannot expose.
Install `@langchain/core` 0.3 or 1.x (an optional peer dependency) alongside
the SDK.

```typescript
import { FerroChatModel } from "@ferro-labs-ai/sdk/langchain";
import { HumanMessage } from "@langchain/core/messages";

const llm = new FerroChatModel({
  model: "gpt-4o",
  apiKey: "sk-ferro-your-key",
  baseUrl: "http://localhost:8080",
});

const res = await llm.invoke([new HumanMessage("Hello")]);
console.log(res.content);
console.log(res.response_metadata.trace_id); // Ferro request ID
```

You can also point any OpenAI-compatible LangChain model at the gateway:

```typescript
import { ChatOpenAI } from "@langchain/openai";

const llm = new ChatOpenAI({
  openAIApiKey: "sk-ferro-your-key",
  configuration: { baseURL: "http://localhost:8080/v1" },
  modelName: "gpt-4o",
});
```

### LlamaIndex.TS

```typescript
import { OpenAI } from "llamaindex";

const llm = new OpenAI({
  apiKey: "sk-ferro-your-key",
  additionalSessionOptions: { baseURL: "http://localhost:8080/v1" },
  model: "gpt-4o",
});
```

---

## Usage

### Chat completions

```typescript
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Explain LLM routing in one paragraph." },
  ],
  temperature: 0.7,
  max_tokens: 256,
});

console.log(response.choices[0]?.message.content);
console.log(`Provider: ${response.provider} | tokens: ${response.usage?.total_tokens}`);
```

`max_completion_tokens` supersedes `max_tokens` (both are accepted), and
`parallel_tool_calls`, `seed`, `response_format` and `tool_choice`
(`"auto" | "none" | "required" | { type: "function", ... }`) are forwarded as-is.

### Streaming

```typescript
const stream = await client.chat.completions.create({
  model: "claude-3-5-sonnet-20241022",
  messages: [{ role: "user", content: "Write a haiku about Go performance." }],
  stream: true,
  stream_options: { include_usage: true }, // ask for a terminal usage chunk
});

console.log(`trace ${stream.trace_id}`); // available before the first chunk

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
  if (chunk.usage) console.log(`\n${chunk.usage.total_tokens} tokens`);
}
```

Breaking out of the loop (or calling `stream.abort()`) cancels the underlying
request. A stream that stalls for longer than the client `timeout` rejects
with `FerroConnectionError`; a mid-stream gateway error frame rejects with
`FerroStreamError` carrying the gateway's `code`. Streaming requests are
never retried.

### Embeddings

```typescript
const response = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: ["Ferro routes LLM requests", "across 30 providers"],
});

const vectors = response.data.map((d) => d.embedding);
console.log(`Embedding dimensions: ${vectors[0]?.length}`);
```

### Image generation

```typescript
const response = await client.images.generate({
  model: "dall-e-3",
  prompt: "A futuristic AI gateway routing data streams across glowing servers",
  size: "1024x1024",
  quality: "hd",
});

console.log(response.data[0]?.url);
```

### Model catalog

```typescript
// Every model the gateway can route right now (GET /v1/models)
const models = await client.models.list();

// Filters are applied client-side over that catalog — the gateway ignores
// query parameters on /v1/models.
const anthropicModels = await client.models.list({ provider: "anthropic" }); // matches owned_by
const visionModels = await client.models.list({ capability: "vision" });     // matches capabilities[]
const gptModels = await client.models.search("gpt");                          // substring on id

// A catalog lookup — never a request to /v1/models/{id}. Throws
// FerroNotFoundError (code "model_not_found") when the id is not listed.
const info = await client.models.retrieve("gpt-4o");
console.log(info.owned_by, info.mode, info.context_window, info.capabilities);
```

Each entry mirrors the gateway's `EnrichedModelInfo`: `id`, `object`, `created`,
`owned_by`, and optionally `mode`, `context_window`, `max_output_tokens`,
`capabilities[]`, `status`, `deprecated`. There are no pricing fields.

### Responses API

```typescript
const res = await client.responses.create({
  model: "gpt-4o-mini",
  input: "Summarise the plot of Dune in one sentence.",
});
console.log(res.output, res.provider, res.trace_id);

// id-routed calls need `responses_target` in the gateway config (501 otherwise)
const again = await client.responses.retrieve(res.id);
await client.responses.delete(res.id);
```

Non-streaming only in 0.3.x. The `Response` type is intentionally loose (index
signature) because the gateway relays the provider body verbatim.

### Rerank and moderations

```typescript
const ranked = await client.rerank({
  model: "rerank-v3.5",
  query: "best gateway for LLM routing",
  documents: ["Ferro Labs AI Gateway", "A recipe for pancakes"],
  top_n: 1,
});

const verdict = await client.moderations.create({
  model: "omni-moderation-latest", // required by ai-gateway v1.4.x
  input: "some user text",
});
```

### Health and capabilities

```typescript
const health = await client.health();   // GET /health   (body returned on 200 and 503)
const ready  = await client.ready();    // GET /readyz   (body returned on 200 and 503)
const live   = await client.live();     // GET /livez
const caps   = await client.capabilities(); // GET /v1/capabilities

console.log(health.version, health.commit, ready.status);
console.log(caps.providers["openai"]?.["parallel_tool_calls"]); // "forward" | "translate" | "unsupported"
```

The three probes are unauthenticated on the gateway; the client still sends
its bearer, which the gateway ignores there.

---

## Observability

Inference responses (`chat.completions`, `embeddings`, `images`, `responses`,
`rerank`, `moderations`) carry gateway metadata merged from the response. Catalog,
health and admin bodies are returned untouched.

| Field | Type | Populated from | Present on |
|---|---|---|---|
| `response.trace_id` | `string` (32 hex) | `X-Request-ID` header — equals the gateway's OTel trace id; grep it in `/admin/logs` and your tracing backend | every response, and `Stream.trace_id` + every streamed chunk |
| `response.provider` | `string` | body `provider` on `/v1/chat/completions`; `X-Gateway-Provider` header on `/v1/responses` and pass-through routes | non-streaming chat, responses, rerank, moderations. **Not on SSE streams** (the gateway does not set it there yet) nor on embeddings/images |
| `response.gateway_overhead_ms` | `number` | `X-Gateway-Overhead-Ms` header — time spent inside the gateway, **not** end-to-end latency | non-streaming `/v1/chat/completions` only |
| `response.usage.prompt_tokens` / `completion_tokens` / `total_tokens` | `number` | body | chat (streaming: terminal chunk when `stream_options.include_usage`), embeddings |
| `response.usage.reasoning_tokens` / `cache_read_tokens` / `cache_write_tokens` | `number?` | body, when the provider reports them | chat |
| `response.provider_metadata` | `object?` | body, provider-specific extras the gateway chose to surface | chat |
| `message.reasoning_content` / `delta.reasoning_content` | `string?` | body, reasoning models | chat |

Cost is **not** exposed to callers by the gateway — it lives in the request log
(`admin.logs.list()` / `.stats()`), Prometheus and the OTel span. There is no
cache-hit signal either.

```typescript
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

console.log(
  `trace=${response.trace_id} provider=${response.provider} ` +
  `overhead=${response.gateway_overhead_ms}ms tokens=${response.usage?.total_tokens}`
);
```

Every row in this table is asserted non-empty by the contract suite against a
real gateway (`tests/contract/contract.test.ts`).

---

## Configuration

```typescript
const client = new FerroClient({
  apiKey: "sk-ferro-...",              // or FERRO_API_KEY env var
  baseUrl: "http://localhost:8080",    // or FERRO_BASE_URL env var
  timeout: 120_000,                    // ms; connect + response, and the stream idle timeout (default: 120,000)
  maxRetries: 2,                       // retries on network errors and 408/429/5xx (default: 2)
  defaultHeaders: { "x-env": "prod" }, // merged into every request
  fetch: customFetchFn,               // bring your own fetch (testing, polyfill)
});
```

**Retries** cover network errors (DNS failures, connection refused, timeouts) and HTTP `408`, `429`, `500`, `502`, `503`, `504`. Each retry waits for the server's `Retry-After` (seconds, capped at 30 s) when present, otherwise full-jitter exponential backoff from 500 ms capped at 8 s — the same policy the gateway uses upstream. Other 4xx propagate immediately as typed exceptions. Streaming requests are never retried. `defaultHeaders` cannot override `Authorization`.

**Bring-your-own fetch** lets you use a custom implementation for testing, proxies, or runtime polyfills:

```typescript
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient({
  apiKey: "sk-ferro-...",
  fetch: myCustomFetch, // e.g. undici fetch, node-fetch, or a mock
});
```

---

## Error handling

```typescript
import {
  FerroClient,
  FerroAuthError,
  FerroBudgetExceededError,
  FerroPermissionError,
  FerroRateLimitError,
  FerroNotFoundError,
  FerroServerError,
  FerroConnectionError,
} from "@ferro-labs-ai/sdk";

try {
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: "Hello" }],
  });
} catch (error) {
  if (error instanceof FerroAuthError) {
    console.error("Invalid API key — check FERRO_API_KEY");
  } else if (error instanceof FerroBudgetExceededError) {
    console.error("Budget exhausted (402 insufficient_quota)");
  } else if (error instanceof FerroPermissionError) {
    console.error("Key lacks the scope for this route (403 insufficient_scope)");
  } else if (error instanceof FerroRateLimitError) {
    console.error(`Rate limited — retry after ${error.retryAfter ?? "?"}s`);
  } else if (error instanceof FerroNotFoundError) {
    console.error("Model or endpoint not found");
  } else if (error instanceof FerroServerError) {
    console.error(`Gateway error ${error.status} — upstream may be down`);
  } else if (error instanceof FerroConnectionError) {
    console.error("Cannot reach gateway — is it running?");
  }
}
```

All HTTP-level exceptions inherit from `FerroAPIError` and expose `.status`, `.code` (the gateway's `error.code`, e.g. `invalid_api_key`, `model_not_found`, `insufficient_scope`), `.message`, and `.requestId` (the `X-Request-ID`). `FerroConnectionError` and `FerroStreamError` (which carries the stream error `code`) inherit from `FerroError` directly.

| Status | Error | Typical gateway codes |
|---|---|---|
| 401 | `FerroAuthError` | `missing_api_key`, `invalid_api_key` |
| 402 | `FerroBudgetExceededError` | `insufficient_quota` |
| 403 | `FerroPermissionError` | `insufficient_scope` |
| 404 | `FerroNotFoundError` | `model_not_found`, `not_found` |
| 429 | `FerroRateLimitError` (`.retryAfter`) | `rate_limit_exceeded`, `provider_saturated` |
| 5xx | `FerroServerError` | `upstream_error`, `not_implemented`, `server_error` |
| other | `FerroAPIError` | `invalid_request`, `request_too_large`, ... |

---

## Admin API (OSS gateway)

These APIs are available on any self-hosted Ferro Labs AI Gateway instance. Requires an admin-scoped API key.

### API keys

```typescript
// Create
const newKey = await client.admin.keys.create({
  name: "backend-service",
  scopes: ["admin"],
});
console.log(newKey.key); // full key value — shown ONCE, store it securely

// List
const keys = await client.admin.keys.list();

// Per-key usage counts
const usage = await client.admin.keys.usage({ limit: 20 });

// Revoke — keeps the record for audit, invalidates immediately
await client.admin.keys.revoke("key_id");

// Rotate — atomically invalidates old, returns new
const rotated = await client.admin.keys.rotate("key_id");

// Permanently delete the record
await client.admin.keys.delete("key_id");
```

### Gateway routing config

```typescript
// Read the current config
const cfg = await client.admin.config.get();
console.log(cfg.strategy); // e.g. { mode: "fallback" }
console.log(cfg.targets);  // list of { virtual_key, weight, ... }

// Replace it (PUT) — hot reload, no restart
await client.admin.config.update({
  strategy: { mode: "fallback" },
  targets: [
    { virtual_key: "openai", weight: 1 },
    { virtual_key: "anthropic", weight: 1 },
    { virtual_key: "groq", weight: 1 },
  ],
  plugins: [
    { name: "cache", enabled: true },
    { name: "logger", enabled: true },
  ],
});

// Inspect history and roll back
const history = await client.admin.config.history();
await client.admin.config.rollback(history[history.length - 2]!.version);
```

### Request logs

```typescript
// Recent failures (default listing is terminal rows only; stage: "all" shows every stage)
const errors = await client.admin.logs.list({ limit: 20, stage: "on_error" });

// Rows for one key, or unauthenticated ones with api_key_id: "none"
const mine = await client.admin.logs.list({ api_key_id: "key-id" });

// Aggregate stats, optionally with a time series
const stats = await client.admin.logs.stats({ buckets: 24 });

// Prune old entries
await client.admin.logs.delete({ before: "2026-01-01T00:00:00Z" });
```

### Audit trail

```typescript
const audit = await client.admin.audit.list({ action: "key.create", limit: 50 });
console.log(audit.summary.total_entries, audit.data[0]?.actor, audit.data[0]?.trace_id);
```

### Providers, plugins, dashboard

```typescript
const providers = await client.admin.providers.list();    // registered LLM providers
const catalog   = await client.admin.providers.catalog(); // every provider this build knows + registered flag
const plugins   = await client.admin.plugins.list();      // configured gateway plugins
const builtins  = await client.admin.plugins.catalog();   // built-in plugins and their settings
const dashboard = await client.admin.dashboard();         // high-level counts
const health    = await client.admin.health();            // authenticated health (includes MCP state)
```

---

## Examples

Runnable examples in the [`examples/`](examples/) directory. Run any with `npx tsx`:

```bash
export FERRO_API_KEY=sk-ferro-...
npx tsx examples/basic.ts
```

<details>
<summary><strong>Basic chat completion</strong></summary>

```typescript
// examples/basic.ts
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient();
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Hello, tell me a short joke." }],
});
console.log(response.choices[0]?.message.content);
console.log(`Provider: ${response.provider} | Trace: ${response.trace_id}`);
```

</details>

<details>
<summary><strong>Streaming</strong></summary>

```typescript
// examples/streaming.ts
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient();
const stream = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "Write a haiku about distributed systems." }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}
```

</details>

<details>
<summary><strong>Multi-provider routing</strong></summary>

```typescript
// examples/multi-provider.ts — same client, different providers
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient();
for (const model of ["gpt-4o-mini", "claude-3-5-sonnet-20241022", "llama-3.3-70b-versatile"]) {
  const r = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: "Say hello in 5 words." }],
  });
  console.log(`[${r.provider}] ${model} → ${r.choices[0]?.message.content}`);
}
```

</details>

<details>
<summary><strong>Tool / function calling</strong></summary>

```typescript
// examples/tool-calling.ts
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient();
const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "What's the weather in SF?" }],
  tools: [{
    type: "function",
    function: {
      name: "get_weather",
      description: "Get current weather for a location.",
      parameters: {
        type: "object",
        properties: { location: { type: "string" } },
        required: ["location"],
      },
    },
  }],
  tool_choice: "auto",
});

for (const call of response.choices[0]?.message.tool_calls ?? []) {
  console.log(`Tool: ${call.function.name}(${call.function.arguments})`);
}
```

</details>

<details>
<summary><strong>Embeddings</strong></summary>

```typescript
// examples/embeddings.ts
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient();
const response = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: ["Ferro routes LLM requests", "across 30 providers"],
});
console.log(`Dimensions: ${response.data[0]?.embedding.length}`);
```

</details>

<details>
<summary><strong>Image generation</strong></summary>

```typescript
// examples/image-generation.ts
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient();
const response = await client.images.generate({
  model: "dall-e-3",
  prompt: "A futuristic AI gateway routing data streams",
  size: "1024x1024",
});
console.log(response.data[0]?.url);
```

</details>

<details>
<summary><strong>Model catalog</strong></summary>

```typescript
// examples/model-catalog.ts
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient();
const models = await client.models.list();
console.log(`Total: ${models.length} models`);

const anthropic = await client.models.list({ provider: "anthropic" }); // client-side filter
console.log(`Anthropic: ${anthropic.length} models`);

const info = await client.models.retrieve("gpt-4o"); // catalog lookup, never /v1/models/{id}
console.log(`${info.owned_by} · ${info.mode} · ${info.context_window?.toLocaleString()} tokens`);
```

</details>

<details>
<summary><strong>Error handling</strong></summary>

```typescript
// examples/error-handling.ts
import { FerroClient, FerroAuthError, FerroRateLimitError, FerroServerError } from "@ferro-labs-ai/sdk";

const client = new FerroClient();
try {
  await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Hello" }],
  });
} catch (error) {
  if (error instanceof FerroAuthError) console.error("Bad API key");
  else if (error instanceof FerroRateLimitError) console.error("Rate limited");
  else if (error instanceof FerroServerError) console.error(`Server error: ${error.status}`);
}
```

</details>

<details>
<summary><strong>Admin: API key management</strong></summary>

```typescript
// examples/admin-keys.ts
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient();
const newKey = await client.admin.keys.create({ name: "backend-svc", scopes: ["read_only"] });
console.log(`Key: ${newKey.key}`); // shown once

const keys = await client.admin.keys.list();
await client.admin.keys.rotate(newKey.id);
await client.admin.keys.delete(newKey.id);
```

</details>

<details>
<summary><strong>Admin: Gateway config</strong></summary>

```typescript
// examples/admin-config.ts
import { FerroClient } from "@ferro-labs-ai/sdk";

const client = new FerroClient();
const config = await client.admin.config.get();
console.log("Strategy:", config.strategy);

await client.admin.config.update({
  strategy: { mode: "fallback" },
  targets: [{ virtual_key: "openai" }, { virtual_key: "anthropic" }],
});

const history = await client.admin.config.history();
await client.admin.config.rollback(history[0]!.version);
```

</details>

---

## Development

```bash
git clone https://github.com/ferro-labs/ferrolabs-typescript-sdk
cd ferrolabs-typescript-sdk
npm install
npm run typecheck     # tsc --noEmit (src + examples)
npm test              # vitest (all HTTP is mocked — no gateway needed)
npm run build         # tsup → dist/ (ESM + CJS + declarations)

# Contract suite against a real gateway (needs Go; builds ../ai-gateway)
FERRO_GATEWAY_SOURCE=../ai-gateway ./scripts/with-gateway.sh
```

All 213 unit tests run in about a second against mocked fetch, so no network or
running gateway is required. The 26 contract tests in `tests/contract/` boot a
real `ferrogw` plus a stub upstream and assert the header/body contract this
README describes; CI runs them against the pinned gateway tag and `main`.

See [CHANGELOG.md](CHANGELOG.md) for release history.

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

## Links

- [Ferro Labs AI Gateway (OSS)](https://github.com/ferro-labs/ai-gateway)
- [Python SDK](https://github.com/ferro-labs/ferrolabs-python-sdk)
- [Documentation](https://docs.ferrolabs.ai)
- [Issue tracker](https://github.com/ferro-labs/ferrolabs-typescript-sdk/issues)
- [Changelog](CHANGELOG.md)
