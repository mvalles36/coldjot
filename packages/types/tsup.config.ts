import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: {
    compilerOptions: {
      incremental: false,
    },
  },
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  sourcemap: true,
  target: "node16",
});
