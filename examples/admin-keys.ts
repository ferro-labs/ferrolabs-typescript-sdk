/**
 * Admin API — manage gateway API keys.
 *
 * Requires an admin-scoped API key.
 *
 * Run:
 *   FERRO_API_KEY=sk-ferro-admin-... npx tsx examples/admin-keys.ts
 */
import { FerroClient } from "../src/index.js";

const client = new FerroClient();

// List existing keys
const keys = await client.admin.keys.list();
console.log(`Existing keys: ${keys.length}`);
for (const key of keys) {
  console.log(`  ${key.name} (${key.id}) — active: ${key.active}, usage: ${key.usage_count}`);
}

// Create a new key
const newKey = await client.admin.keys.create({
  name: "example-service-key",
  scopes: ["read_only"],
});
console.log(`\nCreated key: ${newKey.name}`);
console.log(`  ID: ${newKey.id}`);
console.log(`  Key: ${newKey.key}  ← store this securely, shown once`);

// Check usage stats
const usage = await client.admin.keys.usage({ limit: 5, sort: "usage" });
console.log("\nTop 5 keys by usage:");
console.log(JSON.stringify(usage, null, 2));

// Clean up — delete the example key
await client.admin.keys.delete(newKey.id);
console.log(`\nDeleted key: ${newKey.id}`);
