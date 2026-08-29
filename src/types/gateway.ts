import type { GatewayMetadata } from "../types.js";

// ---------------------------------------------------------------------------
// Health / readiness (unauthenticated)
// ---------------------------------------------------------------------------

/** `GET /health` — 200 when healthy, 503 when degraded; JSON either way. */
export interface HealthResponse {
  status: string;
  version?: string;
  commit?: string;
  built?: string;
  providers?: {
    name: string;
    status: string;
    circuit: string;
    models: number;
  }[];
}

/** `GET /readyz` — 200 `ready` or 503 `not_ready` with a `reason`. */
export interface ReadyResponse {
  status: "ready" | "not_ready";
  reason?: string;
  providers?: { name: string; circuit: string }[];
  targets?: { name: string; routable: boolean }[];
  mcp_servers?: { name: string; ready: boolean; required: boolean }[];
}

/** `GET /livez` */
export interface LiveResponse {
  status: string;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export type ParamSupport = "forward" | "translate" | "unsupported";

/** `GET /v1/capabilities` — only providers named by a configured target. */
export interface CapabilitiesResponse {
  providers: Record<string, Record<string, ParamSupport>>;
  image_response_formats: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Responses API (`/v1/responses`)
// ---------------------------------------------------------------------------

/** Kept loose on purpose: the gateway relays the provider body verbatim. */
export interface ResponseCreateParams {
  model: string;
  input: string | unknown[];
  instructions?: string;
  tools?: unknown[];
  max_output_tokens?: number;
  temperature?: number;
  top_p?: number;
  metadata?: Record<string, string>;
  [key: string]: unknown;
}

export interface Response extends GatewayMetadata {
  id: string;
  object: string;
  created_at: number;
  status: string;
  model: string;
  output: unknown[];
  usage?: Record<string, unknown>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Rerank (`POST /v1/rerank`, Cohere v2 shape)
// ---------------------------------------------------------------------------

export interface RerankParams {
  model: string;
  query: string;
  documents: string[];
  top_n?: number;
}

export interface RerankResponse extends GatewayMetadata {
  id?: string;
  model?: string;
  results: { index: number; relevance_score: number }[];
  meta?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Moderations (`POST /v1/moderations`)
// ---------------------------------------------------------------------------

export interface ModerationCreateParams {
  input: string | string[];
  /** Required: ai-gateway v1.4.5 rejects a request without one (400 `invalid_request`). */
  model: string;
}

export interface ModerationResponse extends GatewayMetadata {
  id: string;
  model: string;
  results: {
    flagged: boolean;
    categories: Record<string, boolean>;
    category_scores: Record<string, number>;
  }[];
}
