import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import {
  apiIsReachable,
  hasSignedInCredentials,
  inviteeEmail,
  MISSING_API,
  MISSING_CREDENTIALS,
} from "./support/session";

test.skip(!hasSignedInCredentials, MISSING_CREDENTIALS);

test.beforeEach(async ({ context }) => {
  await setupClerkTestingToken({ context });
});

/**
 * One address for the whole file, unique per run: the first test leaves a
 * pending invitation behind and the second one needs exactly that row to exist
 * in order to collide with it. A fixed address would pass once and then fail
 * forever against the same instance.
 */
const invitee = inviteeEmail();

/**
 * These two cross every boundary the product has — `getToken()` →
 * `Authorization` → JWKS → Go → Clerk's Backend API — which is the whole point
 * of them and also why they run in order: the conflict only exists because the
 * success happened first.
 */
test.describe("invitar de punta a punta", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    test.skip(!(await apiIsReachable()), MISSING_API);
  });

  test("invitar a un correo nuevo confirma el envío", async ({ page }) => {
    await page.goto("/invitar");

    await page
      .getByLabel("Correo de la persona a la que invitas")
      .fill(invitee);
    await page.getByRole("button", { name: "Enviar invitación" }).click();

    await expect(
      page.getByText(`Invitación enviada a ${invitee}.`),
    ).toBeVisible();
  });

  test("invitar al mismo correo avisa de que ya hay una pendiente", async ({
    page,
  }) => {
    await page.goto("/invitar");

    await page
      .getByLabel("Correo de la persona a la que invitas")
      .fill(invitee);
    await page.getByRole("button", { name: "Enviar invitación" }).click();

    // The API answers 409 with `code: "invitation_already_sent"`; this wording
    // is what that code resolves to in `shared/errors/messages.ts`. Asserting
    // the sentence is asserting that the code survived the trip from Go.
    await expect(
      page.getByRole("alert").filter({
        hasText: "Ya hay una invitación pendiente para ese correo.",
      }),
    ).toBeVisible();
  });
});

/**
 * No API involved, and that is the assertion: the server action parses with
 * Zod before it ever asks Clerk for a token. The address used is one the
 * `type="email"` input accepts — anything more broken and the browser's own
 * validation would block the submit and Zod would never get a turn, so the
 * test would be proving the wrong layer.
 */
test("un correo sin dominio válido lo corta Zod antes de salir a la red", async ({
  page,
}) => {
  await page.goto("/invitar");

  const field = page.getByLabel("Correo de la persona a la que invitas");
  await field.fill("amigo@correo");
  await page.getByRole("button", { name: "Enviar invitación" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "Escribe un correo válido." }),
  ).toBeVisible();
  await expect(field).toHaveAttribute("aria-invalid", "true");
  // The wording Zod produces, not the one the API produces for a rejected
  // address: if this ever reads "No hemos podido enviar la invitación", the
  // request went out when it should not have.
});
