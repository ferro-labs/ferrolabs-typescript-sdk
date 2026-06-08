import { describe, it, expect } from "vitest";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { FerroChatModel } from "../src/langchain/index.js";
import { messagesToFerroParams } from "../src/langchain/messages.js";
import { createMockFetch } from "./helpers/mock-fetch.js";

function makeModel(
  fetchFn: typeof globalThis.fetch,
  overrides: Record<string, unknown> = {},
) {
  return new FerroChatModel({
    model: "gpt-4o",
    apiKey: "sk-test",
    baseUrl: "http://localhost:8080",
    maxRetries: 0,
    fetch: fetchFn,
    logLevel: "none",
    ...overrides,
  });
}

const completionPayload = {
  id: "chat-1",
  object: "chat.completion",
  created: 1,
  model: "gpt-4o",
  provider: "openai",
  latency_ms: 42,
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: "Hello there" },
      finish_reason: "stop",
    },
  ],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
    cost_usd: 0.0001,
    cache_hit: false,
  },
};

describe("FerroChatModel", () => {
  it("returns the assistant text from _generate", async () => {
    const { fetch } = createMockFetch({ json: completionPayload });
    const model = makeModel(fetch);

    const res = await model.invoke([new HumanMessage("Hi")]);

    expect(res).toBeInstanceOf(AIMessage);
    expect(res.content).toBe("Hello there");
  });

  it("surfaces Ferro metadata in response_metadata", async () => {
    const { fetch } = createMockFetch({
      json: completionPayload,
      headers: { "x-trace-id": "trace-abc" },
    });
    const model = makeModel(fetch);

    const res = await model.invoke([new HumanMessage("Hi")]);

    expect(res.response_metadata.trace_id).toBe("trace-abc");
    expect(res.response_metadata.provider).toBe("openai");
    expect(res.response_metadata.latency_ms).toBe(42);
    expect(res.response_metadata.cost_usd).toBe(0.0001);
  });

  it("maps token usage into usage_metadata", async () => {
    const { fetch } = createMockFetch({ json: completionPayload });
    const model = makeModel(fetch);

    const res = await model.invoke([new HumanMessage("Hi")]);

    expect(res.usage_metadata).toEqual({
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
    });
  });

  it("sends mapped system + user messages to the gateway", async () => {
    const { fetch, captured } = createMockFetch({ json: completionPayload });
    const model = makeModel(fetch);

    await model.invoke([new SystemMessage("Be brief"), new HumanMessage("Hi")]);

    const body = captured[0]?.body as { messages: unknown[]; model: string };
    expect(body.model).toBe("gpt-4o");
    expect(body.messages).toEqual([
      { role: "system", content: "Be brief" },
      { role: "user", content: "Hi" },
    ]);
  });

  it("forwards generation params", async () => {
    const { fetch, captured } = createMockFetch({ json: completionPayload });
    const model = makeModel(fetch, { temperature: 0.2, maxTokens: 256 });

    await model.invoke([new HumanMessage("Hi")]);

    const body = captured[0]?.body as Record<string, unknown>;
    expect(body.temperature).toBe(0.2);
    expect(body.max_tokens).toBe(256);
  });

  it("reports the ferro llm type", () => {
    const { fetch } = createMockFetch({ json: completionPayload });
    const model = makeModel(fetch);
    expect(model._llmType()).toBe("ferro-labs-chat");
  });

  it("parses tool calls into LangChain shape", async () => {
    const toolPayload = {
      ...completionPayload,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call-1",
                type: "function",
                function: {
                  name: "get_weather",
                  arguments: '{"city":"Paris"}',
                },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };
    const { fetch } = createMockFetch({ json: toolPayload });
    const model = makeModel(fetch);

    const res = await model.invoke([new HumanMessage("Weather?")]);

    expect(res.tool_calls).toEqual([
      {
        name: "get_weather",
        args: { city: "Paris" },
        id: "call-1",
        type: "tool_call",
      },
    ]);
  });
});

describe("messagesToFerroParams", () => {
  it("maps roles correctly", () => {
    const result = messagesToFerroParams([
      new SystemMessage("sys"),
      new HumanMessage("user"),
      new AIMessage("assistant"),
    ]);

    expect(result).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "user" },
      { role: "assistant", content: "assistant" },
    ]);
  });
});
