import { clerk } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";
import { testUserIdentifier, testUserPassword } from "./session";

/**
 * Signs the test user in, the way this Clerk instance actually allows.
 *
 * Two strategies, because which one works is an instance setting, not a
 * preference. Freak Hub's development instance has `password` enabled as a
 * *credential* but not as a first factor — sign-in there is an email code — so
 * the password strategy silently produces a sign-in that never completes and
 * `Clerk.setActive({ session: null })` quietly leaves the browser signed out.
 * The wait at the end is what turns that into a visible failure instead of a
 * confusing redirect three assertions later.
 *
 * `email_code` needs a `+clerk_test` address: Clerk never delivers to one and
 * always accepts the code 424242 for it, which is exactly what a test user
 * should be. `password` stays wired for an instance configured the other way.
 */
export async function signInAsTestUser(page: Page): Promise<void> {
  // The helper needs `window.Clerk` before it can do anything, so this has to
  // be a page that loads Clerk and does not require a session.
  await page.goto("/");

  await clerk.signIn({
    page,
    signInParams: testUserPassword
      ? {
          strategy: "password",
          identifier: testUserIdentifier,
          password: testUserPassword,
        }
      : { strategy: "email_code", identifier: testUserIdentifier },
  });

  await page.waitForFunction(() => Boolean(window.Clerk?.user));
}
