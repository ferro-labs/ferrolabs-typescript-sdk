# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] - 2026-08-29

The "truth release": verified end to end against `ai-gateway v1.4.5` by a new
contract suite. Requires `ai-gateway >= v1.4.0` and Node.js 20+.

### Breaking

- `latency_ms`, `usage.cost_usd`, `usage.cache_hit` and `usage.provider` are removed from `ChatCompletion`/`Usage`. They were read from `X-Ferro-Latency-Ms` / `X-Ferro-Cost-Usd` / `X-Ferro-Provider` headers that the gateway has never emitted at any tag, so they were always `undefined`. Gateway overhead is now exposed as `gateway_overhead_ms` (from `X-Gateway-Overhead-Ms`); it is not end-to-end latency. Cost is not exposed to callers by the gateway.
- `route_tag` (sent as `x_route_tag`), `template_id` and `template_variables` are removed from `ChatCompletionCreateParams` and from the LangChain adapter (`routeTag`, `templateId`, `templateVariables`). The gateway never read them.
- `models.retrieve(id)` no longer requests `GET /v1/models/{id}` — that route is not native and was forwarded upstream with the operator's credential. It is now a lookup over `models.list()` and throws `FerroNotFoundError` (code `model_not_found`) locally. `models.list({ provider, capability })` and `models.search()` filter client-side; the gateway ignores those query parameters.
- `ModelInfo` mirrors the gateway's `EnrichedModelInfo`: `provider` (required), `input_cost_per_token` and `output_cost_per_token` are gone; `owned_by` is added along with optional `mode`, `context_window`, `max_output_tokens`, `capabilities`, `status`, `deprecated`.
- `Stream` is constructed from a `Response` (`Stream.fromSSE` is now `async`) and the SDK's `HttpClient.stream` returns the `Response`. Only code that constructed `Stream` by hand is affected.
- The client identifier header is `X-Gateway-Client` (was `X-Ferro-Client`). Legacy `x-trace-id` / `x-ferro-request-id` fallbacks are gone; `trace_id` comes from `X-Request-ID` only.
- `engines.node` is `>=20`; Node 18 (EOL) is no longer supported. `@langchain/core` peer range is `>=0.3.0 <2.0.0`.
- Sourcemaps are no longer shipped (they pointed at `src/`, which is not in the package).
- A `POST` that hits the client timeout is no longer retried (0.2.x retried every timeout). With `fetch` a read timeout is indistinguishable from a connect timeout, so re-sending could execute a chat/embeddings/images/admin request twice. Network failures before any response and HTTP 429 are still retried for every method.

### Added

- `provider` is populated from the response body on chat and from `X-Gateway-Provider` on `/v1/responses` and pass-through routes; `trace_id` and `provider` are exposed as `Stream.trace_id` / `Stream.provider` and stamped on every streamed chunk.
- `stream_options: { include_usage }` on chat requests; the terminal chunk's `usage` is typed. `Usage` gains `reasoning_tokens`, `cache_read_tokens`, `cache_write_tokens`; messages and deltas gain `reasoning_content`; `ChatCompletion` gains `provider_metadata`. Request params gain `max_completion_tokens`, `parallel_tool_calls`, `seed`, and `tool_choice` accepts `"auto" | "none" | "required" | ToolChoice`.
- `client.responses.create()` / `.retrieve()` / `.delete()` (`/v1/responses`; id routes answer 501 unless the gateway sets `responses_target`).
- `client.capabilities()`, `client.health()`, `client.ready()`, `client.live()` (health/ready return the JSON body on 503 too), `client.rerank()`, `client.moderations.create()` (`model` is required — ai-gateway v1.4.5 rejects a request without one).
- `admin.audit.list()`, `admin.providers.catalog()`, `admin.plugins.catalog()`; `admin.logs.list({ api_key_id })`; `admin.logs.stats({ buckets })`.
- `FerroBudgetExceededError` (402 `insufficient_quota`), `FerroPermissionError` (403 `insufficient_scope`), `FerroRateLimitError.retryAfter`, `FerroStreamError.code`. Typed errors now carry the gateway's `error.code`.
- Retries with full-jitter exponential backoff (500 ms base, 8 s cap), honouring `Retry-After` (capped at 30 s). HTTP 429 and network failures before any response are retried for every method; HTTP 408/5xx and the per-attempt timeout only for idempotent methods (`GET`, `HEAD`, `PUT`, `DELETE`, `OPTIONS`). Previously only network errors were retried, with no delay.
- Streaming: `Accept: text/event-stream`, per-event SSE parsing (`\n\n` frames, multi-line `data:`, `event:`/`id:`/`retry:`/comments ignored, CRLF tolerated), reader cancelled on early `break`, clean `abort()`, a read-side idle timeout (rejects with `FerroConnectionError`), and mid-stream `{"error": ...}` frames mapped to `FerroStreamError`.
- Contract suite (`tests/contract/`, `scripts/with-gateway.sh`) that boots a real `ferrogw` plus a stub upstream; CI runs it against `ai-gateway v1.4.5` (required) and `main` (reporting), and `publish.yml` runs the pinned leg before `npm publish`.
- LangChain adapter tested against `@langchain/core` 1.x; streamed `AIMessageChunk`s carry `response_metadata: { trace_id, provider }`.
- `examples/` are now linted and type-checked; Dependabot config for npm and GitHub Actions; tsup code-splitting so the `langchain` entry no longer duplicates the core.

### Fixed

- `defaultHeaders` could override `Authorization`.
- Gateway metadata was merged into every JSON body, including `/v1/models` and `/admin/*`; it now applies to inference responses only.
- README claims that never matched the code (observability fields, server-side model filtering, Node 18, test count, old package name in `SECURITY.md`).

### Removed

- Every `X-Ferro-*` / `x-trace-id` reference — that header contract never existed.

## [0.2.0] - 2026-06-08

### Added

- LangChain.js adapter exposed via the `@ferro-labs-ai/sdk/langchain` sub-export. `FerroChatModel` extends LangChain's `BaseChatModel`, supports non-streaming (`_generate`) and streaming (`_streamResponseChunks`) generation, tool binding (`bindTools`), and surfaces Ferro metadata (`trace_id`, `provider`, `latency_ms`, `cost_usd`, `cache_hit`) in `response_metadata` plus token counts in `usage_metadata`. `@langchain/core` is an optional peer dependency. Mirrors the `langchain-ferrolabsai` Python adapter.

### Fixed

- Surface gateway metadata on successful responses. `trace_id`, `provider`, and `latency_ms` are now merged from the `x-trace-id` / `x-request-id` / `x-ferro-provider` / `x-ferro-latency-ms` response headers into the parsed body, and `usage.cost_usd` from `x-ferro-cost-usd`. Previously these were only populated when the gateway echoed them in the JSON body. Body fields stay authoritative when both sources are present. Matches the `ferrolabsai` Python SDK behaviour and makes `trace_id` a reliable join key for observability bridges.

## [0.1.0] - 2026-04-28

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

[Unreleased]: https://github.com/ferro-labs/ferrolabs-typescript-sdk/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/ferro-labs/ferrolabs-typescript-sdk/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/ferro-labs/ferrolabs-typescript-sdk/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/ferro-labs/ferrolabs-typescript-sdk/releases/tag/v0.1.0
