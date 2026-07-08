import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;
const baseURL = process.env.BASE_URL || (isCI ? "http://localhost:3000" : "http://localhost:13100");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    trace: "on",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: (isCI || process.env.START_WEBSERVER) ? [
    {
      command:
        "docker network inspect pmi_default >/dev/null 2>&1 || docker network create pmi_default && docker compose -f ../docker-compose.yml up api",
      url: "http://localhost:18100/categories",
      timeout: 180_000,
      reuseExistingServer: !isCI,
    },
    {
      command: "PMI_API_PROXY_TARGET=http://localhost:18100 npm run dev -- --hostname 127.0.0.1 --port 3000",
      url: "http://localhost:3000",
      timeout: 120_000,
      reuseExistingServer: !isCI,
    },
  ] : undefined,
});
