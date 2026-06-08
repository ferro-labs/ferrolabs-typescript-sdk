// ---------------------------------------------------------------------------
// Chat Completions
// ---------------------------------------------------------------------------

export interface ChatCompletionCreateParams {
  model: string;
  messages: ChatMessageParam[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  top_p?: number;
  n?: number;
  seed?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string | string[];
  tools?: Tool[];
  tool_choice?: string | ToolChoice;
  response_format?: ResponseFormat;
  logprobs?: boolean;
  top_logprobs?: number;
  logit_bias?: Record<string, number>;
  user?: string;
  /** Ferro-specific: server-side prompt template ID */
  template_id?: string;
  /** Ferro-specific: variables for template */
  template_variables?: Record<string, unknown>;
  /** Ferro-specific: routing tag */
  route_tag?: string;
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
// Chat Completion Response
// ---------------------------------------------------------------------------

export interface ChatCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Choice[];
  usage: Usage | null;
  /** Ferro-specific: trace ID from x-ferro-trace-id header */
  trace_id?: string;
  /** Ferro-specific: provider that handled the request */
  provider?: string;
  /** Ferro-specific: gateway latency in milliseconds */
  latency_ms?: number;
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

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: StreamChoice[];
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
  /** Ferro-specific: estimated cost in USD */
  cost_usd?: number;
  /** Ferro-specific: whether response was served from cache */
  cache_hit?: boolean;
  /** Ferro-specific: which provider handled the request */
  provider?: string;
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

export interface EmbeddingResponse {
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

export interface ImageResponse {
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

export interface ModelListParams {
  provider?: string;
  capability?: string;
}

export interface ModelInfo {
  id: string;
  object: string;
  created?: number;
  provider: string;
  context_window?: number;
  max_output_tokens?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  capabilities?: string[];
  status?: string;
}

// ---------------------------------------------------------------------------
// Admin: Keys
// ---------------------------------------------------------------------------

export interface APIKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  active: boolean;
  created_at: string;
  expires_at?: string | null;
  last_used_at?: string | null;
  usage_count: number;
  revoked_at?: string | null;
  rotated_at?: string | null;
}

export interface CreatedAPIKey {
  id: string;
  name: string;
  key: string;
  scopes: string[];
  active: boolean;
  created_at: string;
  expires_at?: string | null;
}

export interface KeyCreateParams {
  name: string;
  scopes?: string[];
  expires_at?: string;
}

export interface KeyUpdateParams {
  name?: string;
  scopes?: string[];
  expires_at?: string;
  active?: boolean;
  clear_expiration?: boolean;
}

export interface KeyUsageParams {
  limit?: number;
  offset?: number;
  sort?: "usage" | "last_used";
  active?: boolean;
  since?: string;
}

// ---------------------------------------------------------------------------
// Admin: Config
// ---------------------------------------------------------------------------

export interface GatewayConfig {
  strategy: Record<string, unknown>;
  targets: Record<string, unknown>[];
  plugins: Record<string, unknown>[];
  aliases: Record<string, string>;
  raw: Record<string, unknown>;
}

export interface ConfigHistoryEntry {
  version: number;
  config: Record<string, unknown>;
  updated_at: string;
  rolled_back_from?: number | null;
}

// ---------------------------------------------------------------------------
// Admin: Logs
// ---------------------------------------------------------------------------

export interface LogListParams {
  limit?: number;
  offset?: number;
  stage?: string;
  provider?: string;
  model?: string;
  since?: string;
}

export interface LogStatsParams {
  limit?: number;
  since?: string;
  stage?: string;
  provider?: string;
  model?: string;
}

export interface LogDeleteParams {
  before?: string;
  stage?: string;
  provider?: string;
  model?: string;
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
