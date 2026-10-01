import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
export default defineConfig({ resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }, test: { environment: "node", include: ["tests/sync-db.integration.ts"], testTimeout: 15000, hookTimeout: 30000, fileParallelism: false } });
