import { expect, test as setup } from "@playwright/test";
import {
  hasSignedInCredentials,
  MISSING_CREDENTIALS,
  STORAGE_STATE,
} from "./support/session";
import { signInAsTestUser } from "./support/sign-in";

setup.skip(!hasSignedInCredentials, MISSING_CREDENTIALS);

/**
 * The first signed-in journey, and the one every other one stands on: sign in
 * for real and land on `/inicio`.
 *
 * It happens once per run. The session is written to disk and every spec in
 * the `signed-in` project starts from it, so the rest of the suite exercises
 * the product instead of re-exercising Clerk's sign-in form.
 */
setup(
  "iniciar sesión aterriza en /inicio y deja la sesión guardada",
  async ({ page }) => {
    await signInAsTestUser(page);

    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/inicio$/);
    // Proof the session survived the navigation and not just the sign-in call:
    // the shell only renders the handle when `currentUser()` resolved.
    await expect(
      page
        .getByRole("navigation", { name: "Navegación principal" })
        .getByText(/^@\S+$/),
    ).toBeVisible();

    await page.context().storageState({ path: STORAGE_STATE });
  },
);
