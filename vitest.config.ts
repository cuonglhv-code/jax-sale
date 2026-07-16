import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    // Constitution Principle IV: integration tests run against a LIVE local Supabase stack,
    // SEQUENTIALLY, with shared state (intentional). No auth/DB mocking for isolation/permission
    // proofs. fileParallelism:false serializes across files; maxWorkers:1 keeps a single worker;
    // sequence.concurrent:false keeps tests within a file in order.
    globals: true,
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
    sequence: { concurrent: false },
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
