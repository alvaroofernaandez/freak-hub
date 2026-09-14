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
  /*
   * The HTML report is emitted in CI too, not just locally. The "github"
   * reporter only writes inline annotations, and the signed-in step is
   * advisory: without a report to download, a journey that breaks leaves an
   * amber step and nothing to read, which is how a suite rots unnoticed.
   *
   * Uploading it is only safe because the `setup` project records no trace.
   * Not uploading `test-results/` is NOT what makes it safe: the HTML reporter
   * copies attachments into the report directory, so a trace reaches
   * `playwright-report/data/*.zip` either way. Measured on a failing setup with
   * CI=true, before that was fixed: one zip carrying 19 `set-cookie` headers,
   * 92 `__clerk_db_jwt`, 66 `__client` and 4 JWTs — from a sign-in that did not
   * even succeed. This repository is public, and a public repository's
   * artifacts are downloadable by anyone who can read it.
   */
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
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
      /*
       * No trace, ever. This is the one project that handles credentials *and*
       * retries (it inherits CI's two), and `trace: "on-first-retry"` would
       * start recording exactly when a transient Clerk hiccup is followed by a
       * successful second attempt — capturing a complete sign-in, session JWT
       * and `Set-Cookie` included. That is the same material `storageState`
       * is git-ignored to keep out of the repository, and the HTML report
       * would carry it into a downloadable artifact.
       *
       * The cost is real and accepted: a sign-in that breaks must be diagnosed
       * from its error and the reporter's output. That is a worse afternoon
       * than reading a trace, and still the right trade.
       */
      use: { ...chrome, trace: "off" },
    },
    /*
     * The perimeter: what happens with no session. It depends on nothing, so a
     * Clerk outage, a missing secret or a fork's pull request cannot stop it
     * from running — it is the suite that catches a protected route going
     * public, which is the worst regression this product can ship.
     *
     * Defined by what it excludes, never by a list of filenames. A project that
     * matched only `auth.spec.ts` would silently drop every perimeter spec
     * written after it: a new `biblioteca.spec.ts` would belong to no project,
     * be collected by none, and the run would still print green. With eight
     * authenticated routes arriving in epic #10, that is not a hypothetical.
     */
    {
      name: "signed-out",
      testIgnore: /\.signed-in\.spec\.ts$/,
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
      /*
       * `retries: 0` alone is not enough to keep a trace out of here. A CLI
       * `--retries=1` overrides it, `on-first-retry` arms, and the trace picks
       * the session up out of the injected storageState — measured: two
       * `__session`, two `__client`, two JWTs. This project never needs a
       * trace, so it never gets one, and the flag has nothing left to re-arm.
       */
      use: { ...chrome, storageState: STORAGE_STATE, trace: "off" },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
