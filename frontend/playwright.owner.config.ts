import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./live-tests",
  testMatch: "isolated-owner.spec.ts",
  outputDir: "./test-results/owner-integration",
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3107", browserName: "chromium", channel: "chromium", trace: "off", screenshot: "off", video: "off" },
  webServer: { command: "npm run start -- --hostname 127.0.0.1 --port 3107", url: "http://127.0.0.1:3107", reuseExistingServer: false, env: { NEXT_TELEMETRY_DISABLED: "1" } },
});
