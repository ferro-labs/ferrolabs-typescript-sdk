import {
  BaseChatModel,
  type BaseChatModelCallOptions,
  type BaseChatModelParams,
  type BindToolsInput,
} from "@langchain/core/language_models/chat_models";
import type { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  AIMessage,
  AIMessageChunk,
  type BaseMessage,
  type UsageMetadata,
} from "@langchain/core/messages";
import type {
  ToolCall as LangChainToolCall,
  ToolCallChunk,
} from "@langchain/core/messages/tool";
import {
  ChatGenerationChunk,
  type ChatGeneration,
  type ChatResult,
} from "@langchain/core/outputs";
import type { Runnable } from "@langchain/core/runnables";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";

import { FerroClient } from "../client.js";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  FerroClientOptions,
  ToolCall,
} from "../types.js";
import { messagesToFerroParams } from "./messages.js";

/**
 * Call options understood by {@link FerroChatModel}.
 */
export interface FerroCallOptions extends BaseChatModelCallOptions {
  /** Tools to expose to the model for this invocation. */
  tools?: ChatCompletionCreateParams["tools"];
  /** Override the gateway's tool-selection behaviour. */
  tool_choice?: ChatCompletionCreateParams["tool_choice"];
}

/**
 * Constructor fields for {@link FerroChatModel}.
 *
 * Combines the LangChain base params, the Ferro client connection options, and
 * the per-request generation parameters routed to the gateway.
 */
export interface FerroChatModelFields
  extends
    BaseChatModelParams,
    Pick<
      FerroClientOptions,
      | "apiKey"
      | "baseUrl"
      | "timeout"
      | "maxRetries"
      | "defaultHeaders"
      | "fetch"
      | "logLevel"
    > {
  /** Model name routed by the gateway (e.g. `"gpt-4o"`). */
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  /** Ferro-specific: override the gateway routing strategy for this caller. */
  routeTag?: string;
  /** Ferro-specific: server-side prompt template ID. */
  templateId?: string;
  /** Ferro-specific: variables for the server-side template. */
  templateVariables?: Record<string, unknown>;
  user?: string;
}

/**
 * LangChain.js {@link BaseChatModel} backed by the Ferro Labs AI Gateway.
 *
 * A single instance can address any of the gateway's providers by model name
 * without swapping model classes. Every response surfaces `trace_id` (the Ferro
 * request ID propagated via the `x-trace-id` header — frozen contract since
 * `ai-gateway v1.1.0`) in `response_metadata`, the canonical join key for any
 * downstream observability bridge plugin.
 *
 * @example
 * ```ts
 * import { FerroChatModel } from "@ferro-labs-ai/sdk/langchain";
 * import { HumanMessage } from "@langchain/core/messages";
 *
 * const chat = new FerroChatModel({ model: "gpt-4o", apiKey: "sk-ferro-..." });
 * const res = await chat.invoke([new HumanMessage("Hello")]);
 * console.log(res.content);
 * console.log(res.response_metadata.trace_id); // Ferro request ID
 * ```
 */
export class FerroChatModel extends BaseChatModel<FerroCallOptions> {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string[];
  routeTag?: string;
  templateId?: string;
  templateVariables?: Record<string, unknown>;
  user?: string;

  private readonly clientOptions: FerroClientOptions;
  private clientInstance?: FerroClient;

  constructor(fields: FerroChatModelFields) {
    super(fields);
    this.model = fields.model;
    this.temperature = fields.temperature;
    this.maxTokens = fields.maxTokens;
    this.topP = fields.topP;
    this.frequencyPenalty = fields.frequencyPenalty;
    this.presencePenalty = fields.presencePenalty;
    this.stop = fields.stop;
    this.routeTag = fields.routeTag;
    this.templateId = fields.templateId;
    this.templateVariables = fields.templateVariables;
    this.user = fields.user;

    this.clientOptions = {
      apiKey: fields.apiKey,
      baseUrl: fields.baseUrl,
      timeout: fields.timeout,
      maxRetries: fields.maxRetries,
      defaultHeaders: fields.defaultHeaders,
      fetch: fields.fetch,
      logLevel: fields.logLevel,
    };
  }

  _llmType(): string {
    return "ferro-labs-chat";
  }

  private client(): FerroClient {
    if (!this.clientInstance) {
      this.clientInstance = new FerroClient(this.clientOptions);
    }
    return this.clientInstance;
  }

  private buildParams(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
  ): ChatCompletionCreateParams {
    const params: ChatCompletionCreateParams = {
      model: this.model,
      messages: messagesToFerroParams(messages),
    };

    if (this.temperature !== undefined) params.temperature = this.temperature;
    if (this.maxTokens !== undefined) params.max_tokens = this.maxTokens;
    if (this.topP !== undefined) params.top_p = this.topP;
    if (this.frequencyPenalty !== undefined)
      params.frequency_penalty = this.frequencyPenalty;
    if (this.presencePenalty !== undefined)
      params.presence_penalty = this.presencePenalty;

    const stop = options.stop ?? this.stop;
    if (stop && stop.length > 0) params.stop = stop;

    if (this.routeTag !== undefined) params.route_tag = this.routeTag;
    if (this.templateId !== undefined) params.template_id = this.templateId;
    if (this.templateVariables !== undefined)
      params.template_variables = this.templateVariables;
    if (this.user !== undefined) params.user = this.user;

    if (options.tools !== undefined) params.tools = options.tools;
    if (options.tool_choice !== undefined)
      params.tool_choice = options.tool_choice;

    return params;
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun,
  ): Promise<ChatResult> {
    const params = this.buildParams(messages, options);
    const response = await this.client().chat.completions.create({
      ...params,
      stream: false,
    });
    return completionToChatResult(response);
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun,
  ): AsyncGenerator<ChatGenerationChunk> {
    const params = this.buildParams(messages, options);
    const stream = await this.client().chat.completions.create({
      ...params,
      stream: true,
    });

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;
      const content = choice.delta.content ?? "";
      const generationChunk = new ChatGenerationChunk({
        text: content,
        message: new AIMessageChunk({
          content,
          tool_call_chunks: extractToolCallChunks(chunk),
        }),
        generationInfo: choice.finish_reason
          ? { finish_reason: choice.finish_reason }
          : undefined,
      });
      yield generationChunk;
      await runManager?.handleLLMNewToken(
        content,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          chunk: generationChunk,
        },
      );
    }
  }

  override bindTools(
    tools: BindToolsInput[],
    kwargs?: Partial<FerroCallOptions>,
  ): Runnable<BaseMessage[] | string, AIMessageChunk, FerroCallOptions> {
    const formatted = tools.map((tool) => convertToOpenAITool(tool));
    return this.withConfig({
      tools: formatted as ChatCompletionCreateParams["tools"],
      ...kwargs,
    } as Partial<FerroCallOptions>) as unknown as Runnable<
      BaseMessage[] | string,
      AIMessageChunk,
      FerroCallOptions
    >;
  }
}

// ---------------------------------------------------------------------------
// Response mapping
// ---------------------------------------------------------------------------

function completionToChatResult(response: ChatCompletion): ChatResult {
  const metadata = responseMetadata(response);
  const usage = usageMetadata(response);

  const choice = response.choices[0];
  if (!choice) {
    const empty = new AIMessage({ content: "", response_metadata: metadata });
    return { generations: [{ text: "", message: empty }] };
  }

  const content = choice.message.content ?? "";
  const message = new AIMessage({
    content,
    tool_calls: extractToolCalls(choice.message.tool_calls),
    response_metadata: metadata,
    usage_metadata: usage,
  });

  const generation: ChatGeneration = {
    text: content,
    message,
    generationInfo: choice.finish_reason
      ? { finish_reason: choice.finish_reason }
      : undefined,
  };

  return {
    generations: [generation],
    llmOutput: {
      model: response.model,
      trace_id: response.trace_id,
      provider: response.provider,
    },
  };
}

function responseMetadata(response: ChatCompletion): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  const set = (key: string, value: unknown): void => {
    if (value !== undefined && value !== null) metadata[key] = value;
  };

  set("model", response.model);
  set("id", response.id);
  // ``trace_id`` is the canonical join key. Frozen via x-trace-id since
  // ai-gateway v1.1.0; mirrored by every Ferro observability bridge plugin.
  set("trace_id", response.trace_id);
  set("provider", response.provider);
  set("latency_ms", response.latency_ms);
  if (response.usage) {
    set("cost_usd", response.usage.cost_usd);
    set("cache_hit", response.usage.cache_hit);
  }
  return metadata;
}

function usageMetadata(response: ChatCompletion): UsageMetadata | undefined {
  if (!response.usage) return undefined;
  return {
    input_tokens: response.usage.prompt_tokens,
    output_tokens: response.usage.completion_tokens,
    total_tokens: response.usage.total_tokens,
  };
}

function extractToolCalls(raw: ToolCall[] | undefined): LangChainToolCall[] {
  if (!raw || raw.length === 0) return [];
  const result: LangChainToolCall[] = [];
  for (const call of raw) {
    const argsRaw = call.function.arguments || "{}";
    let args: Record<string, unknown>;
    try {
      args = argsRaw ? (JSON.parse(argsRaw) as Record<string, unknown>) : {};
    } catch {
      args = { _raw: argsRaw };
    }
    result.push({
      name: call.function.name,
      args,
      id: call.id || undefined,
      type: "tool_call",
    });
  }
  return result;
}

function extractToolCallChunks(chunk: ChatCompletionChunk): ToolCallChunk[] {
  const raw = chunk.choices[0]?.delta.tool_calls;
  if (!raw || raw.length === 0) return [];
  return raw.map((call, index) => ({
    type: "tool_call_chunk",
    id: call.id || undefined,
    index,
    name: call.function?.name || undefined,
    args: call.function?.arguments || undefined,
  }));
}
