/**
 * Error handling — demonstrates typed exception catching.
 *
 * Run:
 *   FERRO_API_KEY=sk-ferro-... npx tsx examples/error-handling.ts
 */
import {
  FerroClient,
  FerroAPIError,
  FerroAuthError,
  FerroRateLimitError,
  FerroNotFoundError,
  FerroServerError,
  FerroConnectionError,
} from "../src/index.js";

const client = new FerroClient();

// 1. Successful request
try {
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Say OK" }],
    max_tokens: 5,
  });
  console.log("Success:", response.choices[0]?.message.content);
} catch (error) {
  handleError(error);
}

// 2. Model not found (expected 400 or 404)
try {
  await client.chat.completions.create({
    model: "nonexistent-model-xyz",
    messages: [{ role: "user", content: "Hello" }],
  });
} catch (error) {
  console.log("\nExpected error for bad model:");
  handleError(error);
}

function handleError(error: unknown): void {
  if (error instanceof FerroAuthError) {
    console.error(`  Auth error: ${error.message}`);
  } else if (error instanceof FerroRateLimitError) {
    console.error(`  Rate limited: ${error.message}`);
  } else if (error instanceof FerroNotFoundError) {
    console.error(`  Not found: ${error.message}`);
  } else if (error instanceof FerroServerError) {
    console.error(`  Server error (${error.status}): ${error.message}`);
  } else if (error instanceof FerroConnectionError) {
    console.error(`  Connection failed: ${error.message}`);
  } else if (error instanceof FerroAPIError) {
    console.error(`  API error (${error.status}): ${error.message} [${error.code}]`);
  } else {
    console.error(`  Unknown error:`, error);
  }
}
