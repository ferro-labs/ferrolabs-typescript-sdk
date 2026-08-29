import type { HttpClient } from "../_internal/http.js";
import { Stream } from "../streaming.js";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
} from "../types.js";

export class Completions {
  private readonly http: HttpClient;

  constructor(http: HttpClient) {
    this.http = http;
  }

  create(
    params: ChatCompletionCreateParams & { stream: true },
  ): Promise<Stream<ChatCompletionChunk>>;
  create(
    params: ChatCompletionCreateParams & { stream?: false },
  ): Promise<ChatCompletion>;
  create(
    params: ChatCompletionCreateParams,
  ): Promise<ChatCompletion | Stream<ChatCompletionChunk>>;
  async create(
    params: ChatCompletionCreateParams,
  ): Promise<ChatCompletion | Stream<ChatCompletionChunk>> {
    const body = buildRequestBody(params);

    if (params.stream) {
      return Stream.fromSSE<ChatCompletionChunk>(
        this.http,
        "POST",
        "/v1/chat/completions",
        body,
      );
    }

    return this.http.request<ChatCompletion>("POST", "/v1/chat/completions", {
      json: body,
      meta: true,
    });
  }
}

function buildRequestBody(
  params: ChatCompletionCreateParams,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
  };

  if (params.stream !== undefined) body["stream"] = params.stream;
  if (params.stream_options !== undefined)
    body["stream_options"] = params.stream_options;
  if (params.temperature !== undefined)
    body["temperature"] = params.temperature;
  if (params.max_tokens !== undefined) body["max_tokens"] = params.max_tokens;
  if (params.max_completion_tokens !== undefined)
    body["max_completion_tokens"] = params.max_completion_tokens;
  if (params.top_p !== undefined) body["top_p"] = params.top_p;
  if (params.n !== undefined) body["n"] = params.n;
  if (params.seed !== undefined) body["seed"] = params.seed;
  if (params.frequency_penalty !== undefined)
    body["frequency_penalty"] = params.frequency_penalty;
  if (params.presence_penalty !== undefined)
    body["presence_penalty"] = params.presence_penalty;
  if (params.stop !== undefined) body["stop"] = params.stop;
  if (params.tools !== undefined) body["tools"] = params.tools;
  if (params.tool_choice !== undefined)
    body["tool_choice"] = params.tool_choice;
  if (params.parallel_tool_calls !== undefined)
    body["parallel_tool_calls"] = params.parallel_tool_calls;
  if (params.response_format !== undefined)
    body["response_format"] = params.response_format;
  if (params.logprobs !== undefined) body["logprobs"] = params.logprobs;
  if (params.top_logprobs !== undefined)
    body["top_logprobs"] = params.top_logprobs;
  if (params.logit_bias !== undefined) body["logit_bias"] = params.logit_bias;
  if (params.user !== undefined) body["user"] = params.user;

  return body;
}
