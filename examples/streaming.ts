/**
 * Streaming chat completion — tokens printed in real-time.
 *
 * Run:
 *   FERRO_API_KEY=sk-ferro-... npx tsx examples/streaming.ts
 */
import { FerroClient } from "../src/index.js";

const client = new FerroClient();

const stream = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "Write a haiku about distributed systems." },
  ],
  max_tokens: 100,
  stream: true,
});

process.stdout.write("Streaming response:\n\n");

let totalTokens = 0;
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content;
  if (content) process.stdout.write(content);

  if (chunk.usage) {
    totalTokens = chunk.usage.total_tokens;
  }
}

console.log();
if (totalTokens > 0) {
  console.log(`\nTotal tokens: ${totalTokens}`);
}
