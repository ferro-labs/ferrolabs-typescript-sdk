/**
 * Embedding generation — vectorize text for similarity search.
 *
 * Run:
 *   FERRO_API_KEY=sk-ferro-... npx tsx examples/embeddings.ts
 */
import { FerroClient } from "../src/index.js";

const client = new FerroClient();

const response = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: [
    "Ferro Labs routes LLM requests across providers",
    "AI gateways reduce latency and cost",
    "TypeScript SDK with zero dependencies",
  ],
});

for (const item of response.data) {
  console.log(`[${item.index}] dimensions: ${item.embedding.length}, first 5: [${item.embedding.slice(0, 5).map((v) => v.toFixed(4)).join(", ")}...]`);
}

console.log(`\nModel: ${response.model}`);
console.log(`Total tokens: ${response.usage.total_tokens}`);
