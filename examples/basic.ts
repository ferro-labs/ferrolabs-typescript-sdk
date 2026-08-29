/**
 * Basic chat completion — the simplest use case.
 *
 * Run:
 *   FERRO_API_KEY=sk-ferro-... npx tsx examples/basic.ts
 */
import { FerroClient } from "../src/index.js";

const client = new FerroClient();

const response = await client.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    { role: "user", content: "Hello, tell me a short joke about programming." },
  ],
});

console.log("Provider:", response.provider);
console.log("Model:", response.model);
console.log("Trace ID:", response.trace_id); // X-Request-ID — grep it in gateway logs
console.log();
console.log(response.choices[0]?.message.content);

if (response.usage) {
  console.log();
  console.log(`Tokens: ${response.usage.total_tokens}`);
}
if (response.gateway_overhead_ms !== undefined) {
  console.log(`Gateway overhead: ${response.gateway_overhead_ms}ms`);
}
