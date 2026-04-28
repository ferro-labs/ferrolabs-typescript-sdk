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
console.log(`Handled by: ${response.provider} in ${response.latency_ms}ms`);
```

---

## Why Ferro Labs SDK

- **One API for 30 providers.** OpenAI, Anthropic, Google, Groq, Together, Mistral, Cohere, Bedrock, Vertex, Azure, and more — all via a single client.
- **Drop-in OpenAI replacement.** The surface matches the OpenAI SDK. Change two lines and keep all your existing code.
- **Smart routing built in.** Fallback chains, weighted load balancing, and per-request overrides via `route_tag`.
- **Cost and provider visibility.** Every response includes `provider`, `cost_usd`, `latency_ms`, and `trace_id` — no extra calls.
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
  - [Ferro extras: templates & route tags](#ferro-extras-templates--route-tags)
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

Requires **Node.js 18+** (also works in Bun, Deno, and modern browsers). **Zero runtime dependencies** — uses native `fetch`.

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
console.log(`Cost: $${response.usage?.cost_usd?.toFixed(6)}`);
console.log(`Provider: ${response.provider}`);
```

### Streaming

```typescript
const stream = await client.chat.completions.create({
  model: "claude-3-5-sonnet-20241022",
  messages: [{ role: "user", content: "Write a haiku about Go performance." }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);
}
```

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
// Browse all 2,500+ models
const models = await client.models.list();

// Filter by provider
const anthropicModels = await client.models.list({ provider: "anthropic" });

// Filter by capability
const visionModels = await client.models.list({ capability: "vision" });

// Pricing for a specific model
const info = await client.models.retrieve("gpt-4o");
console.log(`Context window: ${info.context_window?.toLocaleString()} tokens`);
```

### Ferro extras: templates & route tags

The SDK passes two Ferro-specific fields on `chat.completions.create(...)`:

**`template_id` + `template_variables`** — render a server-side prompt template at request time:

```typescript
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "I can't log in" }],
  template_id: "support-agent",
  template_variables: {
    product: "Acme SaaS",
    plan: "Pro",
    date: "2026-04-28",
  },
});
```

**`route_tag`** — override the routing strategy for a single request:

```typescript
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
  route_tag: "low-cost", // forces fallback to cheaper providers
});
```

Both fields are silently ignored by any OpenAI-compatible backend that doesn't understand them, so it's safe to keep them in shared code paths.

---

## Observability

Every `ChatCompletion` includes fields that tell you what the gateway actually did — no extra API calls, no log scraping:

| Field | Type | Source |
|---|---|---|
| `response.provider` | `string` | Which upstream provider served the request (e.g. `"openai"`, `"anthropic"`) |
| `response.trace_id` | `string` | Correlates this request with gateway logs |
| `response.latency_ms` | `number` | End-to-end gateway latency |
| `response.usage.cost_usd` | `number` | Computed cost in USD |
| `response.usage.cache_hit` | `boolean` | Whether the response came from the gateway's semantic cache |
| `response.usage.prompt_tokens` / `completion_tokens` / `total_tokens` | `number` | Standard OpenAI token counts |

```typescript
const response = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello" }],
});

console.log(
  `trace=${response.trace_id} provider=${response.provider} ` +
  `latency=${response.latency_ms}ms cost=$${response.usage?.cost_usd?.toFixed(6)}`
);
```

---

## Configuration

```typescript
const client = new FerroClient({
  apiKey: "sk-ferro-...",              // or FERRO_API_KEY env var
  baseUrl: "http://localhost:8080",    // or FERRO_BASE_URL env var
  timeout: 120_000,                    // milliseconds (default: 120,000)
  maxRetries: 2,                       // retries on connection errors (default: 2)
  defaultHeaders: { "x-env": "prod" }, // merged into every request
  fetch: customFetchFn,               // bring your own fetch (testing, polyfill)
});
```

**Retries** are triggered only by network errors (DNS failures, connection refused, timeouts) — HTTP errors (4xx/5xx) propagate immediately as typed exceptions so you can handle them yourself.

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
  } else if (error instanceof FerroRateLimitError) {
    console.error("Rate limit hit — back off and retry");
  } else if (error instanceof FerroNotFoundError) {
    console.error("Model or endpoint not found");
  } else if (error instanceof FerroServerError) {
    console.error(`Gateway error ${error.status} — upstream may be down`);
  } else if (error instanceof FerroConnectionError) {
    console.error("Cannot reach gateway — is it running?");
  }
}
```

All HTTP-level exceptions inherit from `FerroAPIError` and expose `.status`, `.code`, `.message`, and `.requestId`. `FerroConnectionError` and `FerroStreamError` inherit from `FerroError` directly.

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
// Recent failures
const errors = await client.admin.logs.list({ limit: 20, stage: "on_error" });

// Aggregate stats
const stats = await client.admin.logs.stats();

// Prune old entries
await client.admin.logs.delete({ before: "2026-01-01T00:00:00Z" });
```

### Providers, plugins, dashboard

```typescript
const providers = await client.admin.providers.list(); // registered LLM providers
const plugins   = await client.admin.plugins.list();   // installed gateway plugins
const dashboard = await client.admin.dashboard();       // high-level counts
const health    = await client.admin.health();          // gateway health check
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
console.log(`Provider: ${response.provider} | Tokens: ${response.usage?.total_tokens}`);
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

const anthropic = await client.models.list({ provider: "anthropic" });
console.log(`Anthropic: ${anthropic.length} models`);

const info = await client.models.retrieve("gpt-4o");
console.log(`Context: ${info.context_window?.toLocaleString()} tokens`);
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
npm run typecheck     # tsc --noEmit
npm test              # vitest (all HTTP is mocked — no gateway needed)
npm run build         # tsup → dist/ (ESM + CJS + declarations)
```

All 139 tests run in under a second against mocked fetch, so no network or running gateway is required.

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
