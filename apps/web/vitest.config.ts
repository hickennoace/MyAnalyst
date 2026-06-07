import { defineConfig } from "vitest/config";

// Vitest runs the fast, pure-engine unit tests under src/. Playwright E2E specs live in e2e/ and are
// run separately (npm run test:e2e) — keep them out of Vitest so it doesn't try to load the
// @playwright/test runtime.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
  },
});
