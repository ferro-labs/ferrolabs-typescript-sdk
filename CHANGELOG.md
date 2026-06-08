# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- LangChain.js adapter exposed via the `@ferro-labs-ai/sdk/langchain` sub-export. `FerroChatModel` extends LangChain's `BaseChatModel`, supports non-streaming (`_generate`) and streaming (`_streamResponseChunks`) generation, tool binding (`bindTools`), and surfaces Ferro metadata (`trace_id`, `provider`, `latency_ms`, `cost_usd`, `cache_hit`) in `response_metadata` plus token counts in `usage_metadata`. `@langchain/core` is an optional peer dependency. Mirrors the `langchain-ferrolabsai` Python adapter.

### Fixed

- Surface gateway metadata on successful responses. `trace_id`, `provider`, and `latency_ms` are now merged from the `x-trace-id` / `x-request-id` / `x-ferro-provider` / `x-ferro-latency-ms` response headers into the parsed body, and `usage.cost_usd` from `x-ferro-cost-usd`. Previously these were only populated when the gateway echoed them in the JSON body. Body fields stay authoritative when both sources are present. Matches the `ferrolabsai` Python SDK behaviour and makes `trace_id` a reliable join key for observability bridges.

### Added

- Initial SDK scaffolding
- `FerroClient` with env var resolution (FERRO_API_KEY, OPENAI_API_KEY)
- Chat completions (`client.chat.completions.create()`)
- Streaming support via `Stream<T>` async iterable
- Embeddings (`client.embeddings.create()`)
- Image generation (`client.images.generate()`)
- Model listing (`client.models.list()`, `.retrieve()`, `.search()`)
- Admin API: keys, config, logs, providers, plugins
- Typed error hierarchy (FerroAuthError, FerroRateLimitError, etc.)
- Retry logic for network errors
- Zero runtime dependencies (native fetch)
- ESM + CJS dual output
- CI: Node 18/20/22 matrix
