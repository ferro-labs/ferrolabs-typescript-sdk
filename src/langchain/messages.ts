import type { BaseMessage } from "@langchain/core/messages";

import type { ChatMessageParam, ContentPart, ToolCall } from "../types.js";

/**
 * Convert LangChain `BaseMessage[]` into the Ferro gateway's OpenAI-compatible
 * `ChatMessageParam[]` request shape.
 */
export function messagesToFerroParams(
  messages: BaseMessage[],
): ChatMessageParam[] {
  return messages.map(messageToFerroParam);
}

function messageToFerroParam(message: BaseMessage): ChatMessageParam {
  const role = mapRole(message.getType());
  const content = mapContent(message.content);

  const param: ChatMessageParam = { role, content };

  if (typeof message.name === "string") {
    param.name = message.name;
  }

  // ToolMessage carries a tool_call_id the gateway needs to correlate results.
  const toolCallId = (message as { tool_call_id?: unknown }).tool_call_id;
  if (typeof toolCallId === "string") {
    param.tool_call_id = toolCallId;
  }

  // AIMessage may carry tool calls the model previously requested.
  const toolCalls = (message as { tool_calls?: unknown }).tool_calls;
  const mapped = mapToolCalls(toolCalls);
  if (mapped.length > 0) {
    param.tool_calls = mapped;
  }

  return param;
}

function mapRole(type: string): ChatMessageParam["role"] {
  switch (type) {
    case "human":
      return "user";
    case "ai":
      return "assistant";
    case "system":
    case "developer":
      return "system";
    case "tool":
    case "function":
      return "tool";
    default:
      // "generic" / "remove" and anything unexpected fall back to user so the
      // gateway still receives the content rather than dropping it.
      return "user";
  }
}

function mapContent(
  content: BaseMessage["content"],
): string | ContentPart[] | null {
  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const parts: ContentPart[] = [];
  for (const block of content) {
    if (typeof block !== "object" || block === null) continue;
    const record = block as Record<string, unknown>;

    if (record["type"] === "text" && typeof record["text"] === "string") {
      parts.push({ type: "text", text: record["text"] });
      continue;
    }

    if (record["type"] === "image_url") {
      const imageUrl = record["image_url"];
      if (typeof imageUrl === "string") {
        parts.push({ type: "image_url", image_url: { url: imageUrl } });
      } else if (
        typeof imageUrl === "object" &&
        imageUrl !== null &&
        typeof (imageUrl as Record<string, unknown>)["url"] === "string"
      ) {
        const urlRecord = imageUrl as Record<string, unknown>;
        const part: ContentPart = {
          type: "image_url",
          image_url: { url: urlRecord["url"] as string },
        };
        const detail = urlRecord["detail"];
        if (detail === "auto" || detail === "low" || detail === "high") {
          part.image_url = { url: urlRecord["url"] as string, detail };
        }
        parts.push(part);
      }
    }
  }

  return parts;
}

function mapToolCalls(raw: unknown): ToolCall[] {
  if (!Array.isArray(raw)) return [];

  const result: ToolCall[] = [];
  for (const call of raw) {
    if (typeof call !== "object" || call === null) continue;
    const record = call as Record<string, unknown>;

    const name = record["name"];
    if (typeof name !== "string") continue;

    const args = record["args"];
    const argsString =
      typeof args === "string" ? args : JSON.stringify(args ?? {});

    result.push({
      id: typeof record["id"] === "string" ? record["id"] : "",
      type: "function",
      function: { name, arguments: argsString },
    });
  }
  return result;
}
