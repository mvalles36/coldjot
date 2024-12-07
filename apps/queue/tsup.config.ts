import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: {
    compilerOptions: {
      incremental: false,
    },
  },
  entry: ["src/server.ts"],
  format: ["cjs"],
  sourcemap: false,
  target: "node16",
});
