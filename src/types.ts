// ---------------------------------------------------------------------------
// Chat Completions
// ---------------------------------------------------------------------------

export interface ChatCompletionCreateParams {
  model: string;
  messages: ChatMessageParam[];
  stream?: boolean;
  /** Ask the gateway for a terminal `usage` chunk when streaming. */
  stream_options?: StreamOptions;
  temperature?: number;
  max_tokens?: number;
  /** Supersedes `max_tokens`; the gateway accepts both. */
  max_completion_tokens?: number;
  top_p?: number;
  n?: number;
  seed?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  tools?: Tool[];
  tool_choice?: "auto" | "none" | "required" | ToolChoice;
  parallel_tool_calls?: boolean;
  response_format?: ResponseFormat;
  logprobs?: boolean;
  top_logprobs?: number;
  logit_bias?: Record<string, number>;
  user?: string;
}

export interface StreamOptions {
  include_usage?: boolean;
}

export interface ChatMessageParam {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | ContentPart[] | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string; detail?: "auto" | "low" | "high" };
}

export interface Tool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface ToolChoice {
  type: "function";
  function: { name: string };
}

export interface ResponseFormat {
  type: "text" | "json_object" | "json_schema";
  json_schema?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Gateway metadata (merged from response headers on inference bodies)
// ---------------------------------------------------------------------------

/**
 * Fields the SDK merges into inference responses from the gateway's headers.
 * See the README "Observability" table for exactly what populates each one.
 */
export interface GatewayMetadata {
  /** `X-Request-ID` — 32 hex chars, equals the gateway's OTel trace id. */
  trace_id?: string;
  /** Body `provider` (chat) or the `X-Gateway-Provider` header. */
  provider?: string;
  /** `X-Gateway-Overhead-Ms` — gateway overhead, NOT end-to-end latency. */
  gateway_overhead_ms?: number;
}

// ---------------------------------------------------------------------------
// Chat Completion Response
// ---------------------------------------------------------------------------

export interface ChatCompletion extends GatewayMetadata {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage: Usage | null;
  /** Provider-specific extras the gateway chose to surface. */
  provider_metadata?: Record<string, unknown>;
}

export interface Choice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
  logprobs?: Record<string, unknown> | null;
}

export interface ChatMessage {
  role: string;
  content: string | null;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  index?: number;
  type: "function";
  function: { name: string; arguments: string };
}

// ---------------------------------------------------------------------------
// Streaming
// ---------------------------------------------------------------------------

export interface ChatCompletionChunk extends GatewayMetadata {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: StreamChoice[];
  /** Present only on the terminal chunk, and only with `stream_options.include_usage`. */
  usage?: Usage | null;
}

export interface StreamChoice {
  index: number;
  delta: StreamDelta;
  finish_reason?: string | null;
  logprobs?: Record<string, unknown> | null;
}

export interface StreamDelta {
  role?: string;
  content?: string | null;
  reasoning_content?: string;
  tool_calls?: ToolCall[];
}

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  reasoning_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
}

// ---------------------------------------------------------------------------
// Embeddings
// ---------------------------------------------------------------------------

export interface EmbeddingCreateParams {
  model: string;
  input: string | string[];
  encoding_format?: "float" | "base64";
  dimensions?: number;
  user?: string;
}

export interface EmbeddingResponse extends GatewayMetadata {
  object: string;
  data: EmbeddingData[];
  model: string;
  usage: { prompt_tokens: number; total_tokens: number };
}

export interface EmbeddingData {
  index: number;
  embedding: number[];
  object: string;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export interface ImageGenerateParams {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  quality?: "standard" | "hd";
  response_format?: "url" | "b64_json";
  style?: string;
  user?: string;
}

export interface ImageResponse extends GatewayMetadata {
  created: number;
  data: ImageData[];
}

export interface ImageData {
  url?: string;
  b64_json?: string;
  revised_prompt?: string;
}

// ---------------------------------------------------------------------------
// Models
// ---------------------------------------------------------------------------

/** Filters applied client-side over the full `/v1/models` catalog. */
export interface ModelListParams {
  /** Matches `owned_by`. */
  provider?: string;
  /** Matches an entry of `capabilities[]`. */
  capability?: string;
}

/** Mirrors the gateway's `EnrichedModelInfo` (`GET /v1/models`). */
export interface ModelInfo {
  id: string;
  object: string;
  /** Always present; may be 0 for catalog entries. */
  created: number;
  owned_by: string;
  mode?: string;
  context_window?: number;
  max_output_tokens?: number;
  capabilities?: string[];
  status?: string;
  deprecated?: boolean;
}

// ---------------------------------------------------------------------------
// Client Options
// ---------------------------------------------------------------------------

export interface FerroClientOptions {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
  defaultHeaders?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  /** Enable SDK debug logging. Also configurable via FERRO_LOG_LEVEL env var. */
  logLevel?: "debug" | "info" | "warn" | "error" | "none";
}

export * from "./types/admin.js";
export * from "./types/gateway.js";
