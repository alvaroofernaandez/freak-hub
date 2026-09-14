import { clerk } from "@clerk/testing/playwright";
import type { Page } from "@playwright/test";
import { testUserIdentifier, testUserPassword } from "./session";

/** Clerk's own convention for an address it never delivers to. */
const TEST_ADDRESS = "+clerk_test";

/**
 * Signs the test user in, preferring the strategy that can actually finish.
 *
 * Measured against the development instance, `signIn.create({ identifier })`
 * offers `password`, `email_code` and `reset_password_email_code`, and the
 * password really is checked — a wrong one comes back 422
 * `form_password_incorrect`. But a *correct* one lands on
 * `status: "needs_client_trust"` with `createdSessionId: null` and
 * `supportedSecondFactors: ["email_code"]`: the instance wants the new device
 * verified, and every Playwright context is a brand-new device. Starting from
 * `email_code` skips that entirely, because the code is the verification.
 *
 * What makes it a trap rather than an error is `@clerk/testing@2.2.31`: its
 * `password` branch calls `create` and then `setActive` **without checking the
 * status at all** (the `ticket` and `email_code` branches do check for
 * `complete`), so `setActive({ session: null })` runs and leaves the browser
 * quietly signed out. There is a second silent exit above it, an early
 * `if (!Clerk.client) return`. Hence the wait below: it turns both into a
 * failure at the line that caused them.
 *
 * `password` stays wired for an identifier that is not a test address, which is
 * the one case where `email_code` cannot be used.
 */
export async function signInAsTestUser(page: Page): Promise<void> {
  if (!testUserIdentifier.includes(TEST_ADDRESS) && !testUserPassword) {
    throw new Error(
      `E2E_CLERK_USER_IDENTIFIER (${testUserIdentifier}) no es una dirección ` +
        `${TEST_ADDRESS} y no hay E2E_CLERK_USER_PASSWORD: no hay forma de ` +
        "iniciar sesión. Ver docs/testing.md.",
    );
  }

  // The helper needs `window.Clerk` before it can do anything, so this has to
  // be a page that loads Clerk and does not require a session.
  await page.goto("/");

  await clerk.signIn({
    page,
    signInParams: testUserIdentifier.includes(TEST_ADDRESS)
      ? { strategy: "email_code", identifier: testUserIdentifier }
      : {
          strategy: "password",
          identifier: testUserIdentifier,
          password: testUserPassword,
        },
  });

  // Shorter than the test timeout on purpose: at the default 30 s this guard
  // and the test deadline expire together and the failure reads "Test timeout
  // of 30000ms exceeded", which points at everything and so at nothing.
  await page.waitForFunction(() => Boolean(window.Clerk?.user), undefined, {
    timeout: 10_000,
  });
}
