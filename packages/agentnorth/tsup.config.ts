import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin/agentnorth.ts", "src/index.ts"],
  format: ["esm"],
  target: "node22",
  clean: true,
  sourcemap: true,
  dts: true,
  splitting: false,
});
