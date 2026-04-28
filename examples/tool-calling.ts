/**
 * Tool / function calling — let the model invoke tools.
 *
 * Run:
 *   FERRO_API_KEY=sk-ferro-... npx tsx examples/tool-calling.ts
 */
import { FerroClient } from "../src/index.js";
import type { ChatMessageParam, Tool } from "../src/index.js";

const client = new FerroClient();

const tools: Tool[] = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a location.",
      parameters: {
        type: "object",
        properties: {
          location: { type: "string", description: "City and state, e.g. San Francisco, CA" },
          unit: { type: "string", enum: ["celsius", "fahrenheit"], description: "Temperature unit" },
        },
        required: ["location"],
      },
    },
  },
];

const messages: ChatMessageParam[] = [
  { role: "user", content: "What's the weather like in San Francisco?" },
];

console.log("Sending request with tool definitions...\n");

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages,
  tools,
  tool_choice: "auto",
});

const choice = response.choices[0];
if (!choice) {
  console.log("No response");
  process.exit(1);
}

if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
  console.log("Model wants to call tools:");
  for (const call of choice.message.tool_calls) {
    console.log(`  ${call.function.name}(${call.function.arguments})`);
  }

  // In a real app, you'd execute the tool and send the result back.
  // Here we simulate a tool response.
  const toolCall = choice.message.tool_calls[0]!;
  const toolResult: ChatMessageParam = {
    role: "tool",
    tool_call_id: toolCall.id,
    content: JSON.stringify({
      location: "San Francisco, CA",
      temperature: 62,
      unit: "fahrenheit",
      condition: "Partly Cloudy",
    }),
  };

  console.log("\nSending tool result back...\n");

  const finalResponse = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [...messages, choice.message as ChatMessageParam, toolResult],
    tools,
  });

  console.log("Final answer:", finalResponse.choices[0]?.message.content);
} else {
  console.log("Direct answer:", choice.message.content);
}
