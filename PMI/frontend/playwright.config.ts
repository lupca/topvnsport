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
      use: { 
        ...devices["Desktop Chrome"],
        launchOptions: {
          executablePath: process.env.CHROMIUM_PATH || undefined,
        },
      },
    },
    {
      name: "firefox",
      use: { 
        ...devices["Desktop Firefox"],
        launchOptions: {
          executablePath: process.env.FIREFOX_PATH || undefined,
          firefoxUserPrefs: {
            "security.sandbox.content.level": 0,
          },
        },
      },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: (isCI || process.env.START_WEBSERVER) ? [
    {
      command:
        "docker compose -f ../docker-compose.e2e.yml up api",
      url: "http://localhost:18109/categories",
      timeout: 180_000,
      reuseExistingServer: !isCI,
    },
    {
      command: "PMI_API_PROXY_TARGET=http://localhost:18109 npm run dev -- --hostname 127.0.0.1 --port 3000",
      url: "http://localhost:3000",
      timeout: 120_000,
      reuseExistingServer: !isCI,
    },
  ] : undefined,
});
