/**
 * Browse the model catalog — list, filter, and inspect models.
 *
 * Run:
 *   FERRO_API_KEY=sk-ferro-... npx tsx examples/model-catalog.ts
 */
import { FerroClient } from "../src/index.js";

const client = new FerroClient();

// List all models
const allModels = await client.models.list();
console.log(`Total models: ${allModels.length}`);

// Group by provider (the gateway reports it as owned_by)
const byProvider = new Map<string, number>();
for (const model of allModels) {
  byProvider.set(model.owned_by, (byProvider.get(model.owned_by) ?? 0) + 1);
}
console.log("\nModels per provider:");
for (const [provider, count] of [...byProvider.entries()].sort(
  (a, b) => b[1] - a[1],
)) {
  console.log(`  ${provider}: ${count}`);
}

// Filter by provider — applied client-side over the catalog above
const anthropicModels = await client.models.list({ provider: "anthropic" });
console.log(`\nAnthropic models: ${anthropicModels.length}`);
for (const m of anthropicModels.slice(0, 5)) {
  console.log(`  ${m.id}`);
}

// Retrieve a specific model — a catalog lookup, never a request to /v1/models/{id}
try {
  const info = await client.models.retrieve("gpt-4o");
  console.log(`\ngpt-4o details:`);
  console.log(`  Provider: ${info.owned_by}`);
  console.log(`  Mode: ${info.mode ?? "unknown"}`);
  console.log(
    `  Capabilities: ${info.capabilities?.join(", ") ?? "none listed"}`,
  );
  if (info.context_window)
    console.log(`  Context: ${info.context_window.toLocaleString()} tokens`);
} catch {
  console.log("\ngpt-4o not available in this gateway instance");
}
