import { expect, test } from "@playwright/test";

/**
 * Smoke coverage for the auth perimeter. These are the assertions that would
 * catch the worst possible regression: a protected route becoming public.
 *
 * Signed-in journeys need `@clerk/testing` and a test user; see docs/testing.md.
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
