import { expect, test } from "@playwright/test";

/**
 * Smoke coverage for the auth perimeter. These are the assertions that would
 * catch the worst possible regression: a protected route becoming public.
 *
 * They run in the `signed-out` project, which depends on nothing: no Clerk
 * credentials, no stored session, no API. The signed-in journeys live in
 * `*.signed-in.spec.ts` and are kept apart precisely so that their need for a
 * real instance can never take this file down with it.
 */
test.describe("perímetro de autenticación", () => {
  test("la portada es pública", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "Freak Hub" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Entrar" })).toBeVisible();
  });

  test("una ruta protegida redirige a /entrar cuando no hay sesión", async ({
    page,
  }) => {
    await page.goto("/inicio");

    await expect(page).toHaveURL(/\/entrar/);
  });

  test("invitar exige sesión", async ({ page }) => {
    await page.goto("/invitar");

    await expect(page).toHaveURL(/\/entrar/);
  });

  test("la página de registro se puede abrir con el enlace de invitación", async ({
    page,
  }) => {
    await page.goto("/registro");

    await expect(page.getByText(/no tienes invitación/i)).toBeVisible();
  });
});
