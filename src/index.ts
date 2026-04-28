// Client
export { FerroClient } from "./client.js";

// Errors
export {
  FerroError,
  FerroAPIError,
  FerroAuthError,
  FerroRateLimitError,
  FerroNotFoundError,
  FerroServerError,
  FerroConnectionError,
  FerroStreamError,
} from "./errors.js";

// Streaming
export { Stream } from "./streaming.js";

// Version
export { VERSION } from "./version.js";

// Types — Chat Completions
export type {
  ChatCompletionCreateParams,
  ChatMessageParam,
  ContentPart,
  Tool,
  ToolChoice,
  ToolCall,
  ResponseFormat,
  ChatCompletion,
  Choice,
  ChatMessage,
  ChatCompletionChunk,
  StreamChoice,
  StreamDelta,
  Usage,
} from "./types.js";

// Types — Embeddings
export type {
  EmbeddingCreateParams,
  EmbeddingResponse,
  EmbeddingData,
} from "./types.js";

// Types — Images
export type { ImageGenerateParams, ImageResponse, ImageData } from "./types.js";

// Types — Models
export type { ModelListParams, ModelInfo } from "./types.js";

// Types — Admin
export type {
  APIKey,
  CreatedAPIKey,
  KeyCreateParams,
  KeyUpdateParams,
  KeyUsageParams,
  GatewayConfig,
  ConfigHistoryEntry,
  LogListParams,
  LogStatsParams,
  LogDeleteParams,
} from "./types.js";

// Types — Client Options
export type { FerroClientOptions } from "./types.js";
