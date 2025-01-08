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
  // onSuccess: "node dist/server.js",
  splitting: true,
  treeshake: true,
  minify: true,
  noExternal: ["events"],
  // ignore: ["node_modules/**", "dist/**", ".turbo/**", ".git/**"],
  // watch: process.env.NODE_ENV === "development" && {
  // },
  // Optionally, you can also add these configurations
  platform: "node",
  bundle: true,
  // Ensure proper ESM output
  outDir: "dist",
  // Add these to handle Node.js built-in modules properly
  external: [
    "express",
    "cors",
    "pino",
    "pino-http",
    "bull",
    "ioredis",
    "nodemailer",
  ],
});
