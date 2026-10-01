import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  reporter: "list",
  use: {baseURL:"http://127.0.0.1:3100", browserName:"chromium", trace:"retain-on-failure", launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}},
  webServer: {command:"npm run start -- --hostname 127.0.0.1 --port 3100", url:"http://127.0.0.1:3100/pilot", reuseExistingServer:false, timeout:60000},
});
