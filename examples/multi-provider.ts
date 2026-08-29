/**
 * Multi-provider routing — same client, different models, different providers.
 *
 * Demonstrates that the gateway routes to the correct provider based on model name.
 *
 * Run:
 *   FERRO_API_KEY=sk-ferro-... npx tsx examples/multi-provider.ts
 */
import { FerroClient } from "../src/index.js";

const client = new FerroClient();

const models = [
  "gpt-4o-mini",
  "claude-3-5-sonnet-20241022",
  "llama-3.3-70b-versatile",
];

for (const model of models) {
  try {
    const response = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: "Say hello in exactly 5 words." }],
      max_tokens: 30,
    });

    console.log(`[${response.provider}] ${model}`);
    console.log(`  → ${response.choices[0]?.message.content}`);
    console.log();
  } catch (error) {
    console.log(`[error] ${model}: ${(error as Error).message}`);
    console.log();
  }
}
