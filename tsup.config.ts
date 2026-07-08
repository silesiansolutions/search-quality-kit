import { defineConfig } from "tsup";
export default defineConfig({
  entry: ["src/index.ts", "src/test-utils.ts", "src/cli/index.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  target: "node20",
});
