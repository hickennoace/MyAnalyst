import { defineConfig, devices } from "@playwright/test";

// E2E tests run against a real browser to exercise the parts unit tests can't: the Web Worker
// pipeline, chart rendering, file uploads, and exports. The worker-clone bug that shipped despite
// 47 passing unit tests is exactly the class of regression these catch.
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Build + start a production server (most representative of what ships). Locally, an already-running
  // server on this port is reused so re-runs are fast.
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
