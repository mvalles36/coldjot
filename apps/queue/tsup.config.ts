import { defineConfig } from "tsup";

export default defineConfig({
  clean: true,
  dts: {
    compilerOptions: {
      incremental: false,
    },
  },
  entry: ["src/server.ts"],
  format: ["esm"],
  sourcemap: true,
  target: "node20",
  onSuccess: "node dist/server.js",
  // watch: {
  //   onSuccess: "node dist/server.js",
  //   ignore: ["dist/**/*", "node_modules/**/*"],
  // },
});
