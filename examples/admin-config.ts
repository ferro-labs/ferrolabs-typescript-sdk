/**
 * Admin API — manage gateway routing configuration.
 *
 * Demonstrates reading, updating, and rolling back gateway config.
 * Updates are zero-downtime hot reloads.
 *
 * Run:
 *   FERRO_API_KEY=sk-ferro-admin-... npx tsx examples/admin-config.ts
 */
import { FerroClient } from "../src/index.js";

const client = new FerroClient();

// Read current config
const config = await client.admin.config.get();
console.log("Current strategy:", JSON.stringify(config.strategy));
console.log("Targets:", config.targets.length);
console.log("Plugins:", config.plugins.length);

// Update config — hot reload, no restart needed
await client.admin.config.update({
  strategy: { mode: "fallback" },
  targets: [
    { virtual_key: "openai", weight: 1 },
    { virtual_key: "anthropic", weight: 1 },
  ],
  plugins: [
    { name: "cache", enabled: true },
    { name: "logger", enabled: true },
  ],
});
console.log("\nConfig updated (hot reload)");

// View config history
const history = await client.admin.config.history();
console.log(`\nConfig versions: ${history.length}`);
for (const entry of history.slice(-3)) {
  console.log(`  v${entry.version} — ${entry.updated_at}`);
}

// Rollback to previous version
if (history.length >= 2) {
  const previousVersion = history[history.length - 2]!.version;
  await client.admin.config.rollback(previousVersion);
  console.log(`\nRolled back to v${previousVersion}`);
}
