# Contributing to Ferro Labs TypeScript SDK

Thank you for your interest in contributing!

## Guidelines

This repository follows the same contributing guidelines as the main AI Gateway project. See the [AI Gateway CONTRIBUTING.md](https://github.com/ferro-labs/ai-gateway/blob/main/CONTRIBUTING.md) for commit message format and PR process.

## Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run typecheck

# Build
npm run build
```

## Releases

Release PRs must update the package version, lockfile, runtime version constant, and changelog together. See the [README release checklist](README.md#release-checklist) before tagging; the current workflow publishes to npm from pushed `v*` tags, but GitHub Releases are created manually after npm publish succeeds.

## Adding Features

1. Add types to `src/types.ts`
2. Implement in `src/resources/`
3. Export from `src/index.ts`
4. Add tests in `tests/`
5. Verify: `npm run typecheck && npm test && npm run build`

## Testing

All HTTP calls must be mocked — no real network requests in tests. Use fetch mocks in `tests/helpers/`.

Target: 80%+ coverage.

## Questions?

Open a [GitHub Discussion](https://github.com/ferro-labs/ai-gateway/discussions) or reach out on [Discord](https://discord.gg/YYSKrgBXMz).
