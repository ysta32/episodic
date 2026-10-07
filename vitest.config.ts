import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts", "src/**/*.test.tsx"], setupFiles: ["./vitest.setup.ts"], pool: "threads", poolOptions: { threads: { maxThreads: 4 } } },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
