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
      headers: {
        "x-request-id": "85b1cf6b5b96f49d9c01966c056bfbc7",
        "x-gateway-overhead-ms": "4.2",
      },
    });
    const model = makeModel(fetch);

    const res = await model.invoke([new HumanMessage("Hi")]);

    expect(res.response_metadata).toMatchObject({
      model: "gpt-4o",
      id: "chat-1",
      trace_id: "85b1cf6b5b96f49d9c01966c056bfbc7",
      provider: "openai",
      gateway_overhead_ms: 4.2,
    });
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
  it("forwards bindTools tools to gateway requests", async () => {
    const tool = {
      type: "function",
      function: {
        name: "lookup",
        description: "Lookup a record",
        parameters: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
    } as const;
    const { fetch, captured } = createMockFetch({ json: completionPayload });
    const model = makeModel(fetch);

    const bound = model.bindTools([tool]);
    await bound.invoke([new HumanMessage("Use a tool")]);

    const body = captured[0]?.body as Record<string, unknown>;
    expect(body.tools).toEqual([tool]);
  });

  it("preserves raw tool call indices while streaming", async () => {
    const chunk = {
      id: "chunk-1",
      object: "chat.completion.chunk",
      created: 1,
      model: "gpt-4o",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 2,
                id: "call-2",
                type: "function",
                function: {
                  name: "lookup",
                  arguments: '{"id":"abc"}',
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    };
    const { fetch } = createMockFetch({
      stream: ["data: " + JSON.stringify(chunk), "data: [DONE]"],
    });
    const model = makeModel(fetch);

    const stream = await model.stream([new HumanMessage("Use a tool")]);
    const chunks = [];
    for await (const streamedChunk of stream) {
      chunks.push(streamedChunk);
    }

    expect(chunks[0]?.tool_call_chunks?.[0]?.index).toBe(2);
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
