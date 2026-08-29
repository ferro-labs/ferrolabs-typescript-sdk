# Examples

Runnable examples demonstrating the Ferro Labs TypeScript SDK.

## Prerequisites

- Node.js 20+ with [tsx](https://github.com/privatenumber/tsx) (`npm install -g tsx`)
- A running [Ferro Labs AI Gateway](https://github.com/ferro-labs/ai-gateway) instance
- An API key: `export FERRO_API_KEY=sk-ferro-...`

## Examples

| Example | Description |
|---|---|
| [basic.ts](basic.ts) | Simple chat completion — the starting point |
| [streaming.ts](streaming.ts) | Streaming tokens in real-time via `for await...of` |
| [multi-provider.ts](multi-provider.ts) | Same client routing to OpenAI, Anthropic, and Groq |
| [embeddings.ts](embeddings.ts) | Vector embedding generation |
| [image-generation.ts](image-generation.ts) | Image generation via DALL-E |
| [model-catalog.ts](model-catalog.ts) | Browse, filter, and inspect the 2,500+ model catalog |
| [tool-calling.ts](tool-calling.ts) | Function/tool calling with tool result round-trip |
| [error-handling.ts](error-handling.ts) | Typed exception catching for all error types |
| [admin-keys.ts](admin-keys.ts) | Admin API: create, list, rotate, and delete API keys |
| [admin-config.ts](admin-config.ts) | Admin API: read, update, and rollback gateway config |

## Run an example

```bash
export FERRO_API_KEY=sk-ferro-...
export FERRO_BASE_URL=http://localhost:8080  # optional, defaults to localhost:8080

npx tsx examples/basic.ts
npx tsx examples/streaming.ts
npx tsx examples/multi-provider.ts
```

## Admin examples

Admin examples require an admin-scoped API key:

```bash
export FERRO_API_KEY=sk-ferro-admin-...
npx tsx examples/admin-keys.ts
npx tsx examples/admin-config.ts
```
