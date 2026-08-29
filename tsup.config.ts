import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/langchain/index.ts"],
  format: ["esm", "cjs"],
  external: ["@langchain/core"],
  dts: true,
  // Shared chunk for the core so the langchain entry no longer duplicates it.
  splitting: true,
  // src/ is not shipped, so a sourcemap would point at nothing.
  sourcemap: false,
  clean: true,
  treeshake: true,
  minify: false,
  outDir: "dist",
});
