import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 3417);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./test/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [["line"], ["junit", { outputFile: "test-results/e2e-junit.xml" }], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "line",
  use: {
    baseURL,
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "node test/e2e/fixture-server.mjs",
    url: `${baseURL}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      DATABASE_URL: "",
      OPENAI_API_KEY: "",
      REQUEST_LIMIT: "100",
      ALLOWED_ORIGINS: `${baseURL},https://wayan.com`
    }
  }
});
