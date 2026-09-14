import { defineConfig, devices } from "@playwright/test";
import { STORAGE_STATE } from "./e2e/support/session";

// The Clerk keys and the test user's credentials live outside the repository.
// Node's own loader is used rather than a dotenv dependency, and it never
// overwrites a variable that is already set — so CI secrets win over any file
// that happens to be lying around.
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // Optional: absent in CI, and the perimeter needs none of it.
  }
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

const chrome = devices["Desktop Chrome"];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    /*
     * Signs in once and parks the session on disk. It is a project rather than
     * part of the global setup so that it shows up in the report as the test it
     * is — "iniciar sesión aterriza en /inicio" is a journey, not plumbing.
     */
    {
      name: "setup",
      testMatch: /auth\.setup\.ts$/,
      use: { ...chrome },
    },
    /*
     * The perimeter: what happens with no session. It depends on nothing, so a
     * Clerk outage, a missing secret or a fork's pull request cannot stop it
     * from running — it is the suite that catches a protected route going
     * public, which is the worst regression this product can ship.
     */
    {
      name: "signed-out",
      testMatch: /auth\.spec\.ts$/,
      use: { ...chrome },
    },
    /*
     * The journeys with a session. Separate on purpose: they need a real Clerk
     * instance, so their failures carry a different meaning and must not be
     * confused with the perimeter's.
     *
     * No retries here. One of them sends an invitation, and a second attempt at
     * an invitation that already succeeded fails on its own conflict — a retry
     * would turn a green run red and blame the wrong thing.
     */
    {
      name: "signed-in",
      testMatch: /\.signed-in\.spec\.ts$/,
      dependencies: ["setup"],
      retries: 0,
      use: { ...chrome, storageState: STORAGE_STATE },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
