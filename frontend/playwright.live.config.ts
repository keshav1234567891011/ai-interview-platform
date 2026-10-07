import { defineConfig } from "@playwright/test";
import path from "node:path";
import development from "../config/development.json";

const root = path.resolve(__dirname, "..");
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, ".local", "browsers");
process.env.TEMP = path.join(root, ".local", "tmp");
process.env.TMP = process.env.TEMP;

export default defineConfig({
  testDir: "./live-tests",
  workers: 1,
  timeout: 180_000,
  reporter: "list",
  use: {
    baseURL: `http://${development.frontend.host}:${development.frontend.port}`,
    browserName: "chromium",
    channel: "chromium",
    viewport: { width: 1440, height: 1000 },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
});
