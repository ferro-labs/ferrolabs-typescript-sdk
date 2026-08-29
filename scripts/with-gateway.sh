#!/usr/bin/env bash
# Boot a real AI Gateway checkout plus a stub OpenAI-compatible upstream, run
# the contract suite (tests/contract) against them, and always tear down.
#
#   FERRO_GATEWAY_SOURCE=../ai-gateway ./scripts/with-gateway.sh [vitest args]
#
# The unit suite proves the SDK is correct given a gateway that behaves as
# documented; only this proves the real server agrees. A divergence found here
# is a contract drift: fix the SDK (or raise the gateway pin), then re-run.
#
# No provider credential is needed: the gateway is pointed at the stub via
# OPENAI_BASE_URL with a placeholder key, so chat, streaming, embeddings and
# responses exercise the real routing/plugin/auth path end to end.
set -euo pipefail

command -v curl >/dev/null || { echo "curl is required to probe the gateway" >&2; exit 2; }
command -v go >/dev/null || { echo "go is required to build the gateway" >&2; exit 2; }

sdk="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
gateway_source="${FERRO_GATEWAY_SOURCE:-}"
if [ -z "$gateway_source" ]; then
  candidate="$(cd "$sdk/.." && pwd)/ai-gateway"
  if [ -f "$candidate/go.mod" ] && grep -q '^module github.com/ferro-labs/ai-gateway$' "$candidate/go.mod"; then
    gateway_source="$candidate"
  else
    echo "FERRO_GATEWAY_SOURCE must point to an AI Gateway checkout" >&2
    exit 2
  fi
fi
gateway_source="$(cd "$gateway_source" && pwd)"
work="$(mktemp -d)"
port="${FERRO_CONTRACT_PORT:-18090}"
stub_port="${FERRO_CONTRACT_STUB_PORT:-18091}"
gw_pid=""
stub_pid=""

# A master key of the shape the gateway expects (fgw_ + 32 hex chars).
key="fgw_$(od -An -tx1 -N16 /dev/urandom | tr -d ' \n')"

cleanup() {
  for pid in "$gw_pid" "$stub_pid"; do
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
      wait "$pid" 2>/dev/null || true
    fi
  done
  rm -rf "$work"
}
trap cleanup EXIT

echo "==> building ferrogw from $gateway_source"
(cd "$gateway_source" && go build -o "$work/ferrogw" ./cmd/ferrogw)

echo "==> starting stub upstream on :$stub_port"
node "$sdk/tests/contract/stub-upstream.mjs" "$stub_port" >"$work/stub.log" 2>&1 &
stub_pid=$!

# One target (openai -> the stub) and the request-logger persisting to SQLite
# so /admin/logs and /admin/logs/stats return real rows instead of 501.
cat >"$work/gateway.yaml" <<'YAML'
strategy:
  mode: single
targets:
  - virtual_key: openai
plugins:
  - name: request-logger
    type: logging
    stage: before_request
    enabled: true
    config: { level: info, persist: true }
  - name: request-logger
    type: logging
    stage: after_request
    enabled: true
    config: { level: info, persist: true }
  - name: request-logger
    type: logging
    stage: on_error
    enabled: true
    config: { level: info, persist: true }
YAML

echo "==> starting gateway on :$port"
MASTER_KEY="$key" GATEWAY_CONFIG="$work/gateway.yaml" PORT="$port" \
  REQUEST_LOG_STORE_BACKEND=sqlite REQUEST_LOG_STORE_DSN="$work/requestlog.db" \
  OPENAI_API_KEY=stub-key OPENAI_BASE_URL="http://127.0.0.1:$stub_port/v1" \
  "$work/ferrogw" serve >"$work/gateway.log" 2>&1 &
gw_pid=$!

# /health answers 503 when degraded, which still means "up".
healthy() {
  local code
  code="$(curl -sS --connect-timeout 1 --max-time 1 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$port/health" 2>/dev/null)" || return 1
  [ "$code" = "200" ] || [ "$code" = "503" ]
}

startup_deadline=$((SECONDS + 15))
while (( SECONDS < startup_deadline )); do
  if ! kill -0 "$gw_pid" 2>/dev/null; then
    echo "gateway exited during startup; log follows:" >&2
    cat "$work/gateway.log" >&2
    exit 1
  fi
  if healthy; then
    break
  fi
  sleep 0.25
done

if ! healthy; then
  echo "gateway did not become healthy within 15s; log follows:" >&2
  cat "$work/gateway.log" >&2
  exit 1
fi

echo "==> running the contract suite"
cd "$sdk"
FERRO_CONTRACT_BASE_URL="http://127.0.0.1:$port" FERRO_CONTRACT_MASTER_KEY="$key" \
  FERRO_CONTRACT_STUB_URL="http://127.0.0.1:$stub_port" \
  npx vitest run --config vitest.contract.config.ts "$@"
