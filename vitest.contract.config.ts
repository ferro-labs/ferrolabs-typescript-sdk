import { defineConfig } from "vitest/config";

// Runs against a real ai-gateway started by scripts/with-gateway.sh.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/contract/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
