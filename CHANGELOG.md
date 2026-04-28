# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

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
