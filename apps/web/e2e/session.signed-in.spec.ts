import { setupClerkTestingToken } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";
import { skipWithoutTestSession } from "./support/session";

test.beforeEach(skipWithoutTestSession);

test.beforeEach(async ({ context }) => {
  // The stored session gets the run past the middleware, not past bot
  // protection: Clerk still boots on the client and talks to its Frontend API.
  await setupClerkTestingToken({ context });
});

test.describe("sesión iniciada", () => {
  test("/inicio muestra el identificador del miembro y su menú de sesión", async ({
    page,
  }) => {
    await page.goto("/inicio");

    await expect(page).toHaveURL(/\/inicio$/);

    // `currentUser()` resolving on the server is the precondition for this
    // handle existing at all: the layout renders no user slot without it.
    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    const handle = nav.getByText(/^@\S+$/);
    await expect(handle).toBeVisible();

    const username = (await handle.innerText()).slice(1);
    expect(username).not.toHaveLength(0);

    // The project builds its session control on Radix instead of Clerk's
    // `<UserButton>` (see `features/members/ui/user-menu.tsx`), so what gets
    // asserted is the menu it opens, not the vendor's markup.
    await handle.click();
    await expect(
      page.getByRole("menuitem", { name: "Mi perfil" }),
    ).toHaveAttribute("href", `/miembros/${username}`);
    await expect(
      page.getByRole("menuitem", { name: "Cerrar sesión" }),
    ).toBeVisible();
  });
});
