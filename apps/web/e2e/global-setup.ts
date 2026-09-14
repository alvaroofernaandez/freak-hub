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
 * Nothing in here is allowed to throw, and that is the whole point. A rotated
 * key answers 401, which `@clerk/testing`'s retry does not cover (it retries
 * 408, 429 and 5xx only), and an outage answers 5xx until the retries run out.
 * Either way the exception would escape the global setup, and a global setup
 * that throws takes the entire run with it — including the signed-out
 * perimeter, which needs no credentials at all and is the suite that catches a
 * protected route going public. So: warn loudly, carry on, and let the
 * signed-in tests skip themselves on the token that never arrived.
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

  try {
    await clerkSetup();
  } catch (cause) {
    console.warn(
      "[e2e] clerkSetup() no pudo obtener el testing token de Clerk. " +
        "Los recorridos con sesión se omitirán; el perímetro sigue.",
      cause,
    );
  }
}
