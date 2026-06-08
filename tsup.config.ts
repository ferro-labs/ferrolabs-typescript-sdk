import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/langchain/index.ts"],
  format: ["esm", "cjs"],
  external: ["@langchain/core"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  outDir: "dist",
});
