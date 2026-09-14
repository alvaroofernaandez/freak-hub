import { clerk } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import { hasSignedInCredentials, MISSING_CREDENTIALS } from "./support/session";
import { signInAsTestUser } from "./support/sign-in";

test.skip(!hasSignedInCredentials, MISSING_CREDENTIALS);

/**
 * The only spec that signs in for itself instead of restoring the stored
 * session, and the reason is the assertion: `Clerk.signOut()` revokes the
 * session on Clerk's side, not just in this browser. Restoring the shared one
 * here would pull it out from under every other signed-in test running in
 * parallel. A fresh sign-in is a different Clerk client, so ending it ends
 * nothing else.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("cerrar sesión devuelve /inicio a su redirección", async ({ page }) => {
  await signInAsTestUser(page);

  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/inicio$/);

  await clerk.signOut({ page });

  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/entrar/);
});
