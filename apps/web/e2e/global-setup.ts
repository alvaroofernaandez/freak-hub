import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { clerkSetup } from "@clerk/testing/playwright";
import { STORAGE_STATE } from "./support/session";

/**
 * Runs once, before any worker starts.
 *
 * `clerkSetup()` trades the instance's secret key for a short-lived testing
 * token and leaves it (plus the Frontend API host) in `process.env`, which the
 * workers inherit. That token is what gets an automated browser past Clerk's
 * bot protection — without it a sign-in fails for a reason that has nothing to
 * do with the code under test.
 *
 * It is deliberately conditional. Without a secret key there is no instance to
 * talk to, and throwing here would take the whole run down with it — including
 * the signed-out perimeter, which needs no credentials at all and is the suite
 * that catches the worst regression there is.
 */
export default async function globalSetup(): Promise<void> {
  // A missing file would make the signed-in project fail while creating its
  // browser context, before any test body (and any skip) could run. An empty
  // one lets those tests reach their own explicit skip instead.
  await mkdir(dirname(STORAGE_STATE), { recursive: true });
  await writeFile(STORAGE_STATE, JSON.stringify({ cookies: [], origins: [] }), {
    flag: "wx",
  }).catch(() => {
    // Already there from a previous run: keep the session it holds.
  });

  if (!process.env.CLERK_SECRET_KEY) {
    console.warn(
      "[e2e] Sin CLERK_SECRET_KEY: solo se ejecutará el perímetro sin sesión.",
    );
    return;
  }

  await clerkSetup();
}
