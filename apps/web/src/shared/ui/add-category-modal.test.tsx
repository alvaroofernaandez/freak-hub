import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AddCategoryModalDimmer,
  AddCategoryModalHost,
  AddCategoryModalProvider,
  useAddCategoryModal,
} from "./add-category-modal";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./category-stripe";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

/**
 * `AddCategoryModalHost` picks `Dialog` or `Drawer` via `useMediaQuery`
 * (`(min-width: 640px)`). Every test in this file that doesn't call this
 * gets no `matchMedia` at all (jsdom doesn't implement it), so the hook
 * falls back to its `initial` default of `true` — the wide/`Dialog` path,
 * matching this suite's pre-existing behaviour. Tests that care about the
 * narrow/`Drawer` path call this explicitly.
 */
function mockViewport(isWide: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: isWide,
    media: "(min-width: 640px)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia;
}

function OpenTrigger() {
  const { open } = useAddCategoryModal();
  return (
    <button type="button" onClick={open}>
      Añadir
    </button>
  );
}

function renderModal() {
  return render(
    <AddCategoryModalProvider>
      <OpenTrigger />
      <AddCategoryModalDimmer>
        <p>Contenido de fondo</p>
      </AddCategoryModalDimmer>
      <AddCategoryModalHost />
    </AddCategoryModalProvider>,
  );
}

describe("AddCategoryModal", () => {
  beforeEach(() => {
    push.mockClear();
  });

  afterEach(() => {
    // `mockViewport` replaces `window.matchMedia` for the whole module-level
    // `window`, which otherwise leaks into later tests that rely on jsdom's
    // default (no `matchMedia` at all).
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("renders as a centered Dialog at sm and above", async () => {
    mockViewport(true);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Añadir" }));

    expect(
      screen.getByRole("dialog", { name: "¿Qué quieres añadir?" }),
    ).toBeInTheDocument();
    expect(
      document.querySelector("[data-vaul-drawer]"),
    ).not.toBeInTheDocument();
  });

  it("renders as a bottom Drawer below sm, with the same content", async () => {
    mockViewport(false);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const drawer = document.querySelector("[data-vaul-drawer]");
    expect(drawer).not.toBeNull();
    // A drag handle marks this as the drawer, not the dialog.
    expect(document.querySelector("[data-vaul-handle]")).not.toBeNull();

    const region = screen.getByRole("dialog", { name: "¿Qué quieres añadir?" });
    expect(within(region).getAllByTestId("category-card")).toHaveLength(
      CATEGORY_ORDER.length,
    );
  });

  it("flashes the chosen category before navigating, instead of leaving instantly", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const anime = screen.getByRole("button", { name: CATEGORY_LABELS.anime });
    await user.click(anime);

    // The confirmation is visible first, and the route change waits for it.
    expect(anime).toHaveAttribute("data-selected");
    expect(push).not.toHaveBeenCalled();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/anadir/anime"));
  });

  it("cancels the pending navigation when closed during the confirmation flash", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    await user.click(screen.getByRole("button", { name: CATEGORY_LABELS.tcg }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Outlast the flash: a dismissed picker must not navigate a beat later.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(push).not.toHaveBeenCalled();
  });

  it("is not rendered until something opens it", () => {
    renderModal();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens as an accessible dialog when triggered", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Añadir" }));

    expect(
      screen.getByRole("dialog", { name: "¿Qué quieres añadir?" }),
    ).toBeInTheDocument();
  });

  it("offers the six categories as the lobby's own character cards, without a work count", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const dialog = screen.getByRole("dialog");
    const grid = within(dialog).getByTestId("add-category-modal-grid");
    // Two columns fit a phone; three once there is room for them.
    expect(grid).toHaveClass("grid-cols-2", "sm:grid-cols-3");

    expect(within(grid).getAllByTestId("category-card")).toHaveLength(
      CATEGORY_ORDER.length,
    );
    expect(within(grid).getAllByTestId("category-card-art")).toHaveLength(
      CATEGORY_ORDER.length,
    );
    for (const category of CATEGORY_ORDER) {
      expect(
        within(dialog).getByRole("button", { name: CATEGORY_LABELS[category] }),
      ).toBeInTheDocument();
    }
    expect(within(dialog).queryByText(/obra/i)).not.toBeInTheDocument();
  });

  it("navigates to /anadir/[categoria] and closes when a category is confirmed", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Añadir" }));
    await user.click(screen.getByRole("button", { name: "TCG" }));

    // Navigation waits for the confirmation flash (#43).
    await waitFor(() => expect(push).toHaveBeenCalledWith("/anadir/tcg"));
    // The panel exits through Motion instead of vanishing on the same tick
    // it closes (ADR-0012), so this is a second, separate wait.
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("closes with the visible close button", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Añadir" }));
    await user.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the element that opened it", async () => {
    const user = userEvent.setup();
    renderModal();
    const trigger = screen.getByRole("button", { name: "Añadir" });
    await user.click(trigger);

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("moves focus into the dialog as soon as it opens", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it("traps Tab so it cycles from the last focusable element back to the first", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const dialog = screen.getByRole("dialog");
    const focusable = within(dialog).getAllByRole("button");
    focusable[focusable.length - 1].focus();

    await user.tab();

    expect(focusable[0]).toHaveFocus();
  });

  it("traps Shift+Tab so it cycles from the first focusable element back to the last", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const dialog = screen.getByRole("dialog");
    const focusable = within(dialog).getAllByRole("button");
    focusable[0].focus();

    await user.tab({ shift: true });

    expect(focusable[focusable.length - 1]).toHaveFocus();
  });

  it("hides the dimmed background from assistive tech only while open", async () => {
    const user = userEvent.setup();
    renderModal();
    const background = screen.getByTestId("add-category-modal-dimmer");
    expect(background).not.toHaveAttribute("aria-hidden");

    await user.click(screen.getByRole("button", { name: "Añadir" }));

    expect(background).toHaveAttribute("aria-hidden", "true");

    await user.keyboard("{Escape}");

    expect(background).not.toHaveAttribute("aria-hidden");
  });

  it("leaves the dimming to the overlay, so the page behind stays legible", async () => {
    const user = userEvent.setup();
    renderModal();
    const background = screen.getByTestId("add-category-modal-dimmer");

    await user.click(screen.getByRole("button", { name: "Añadir" }));

    // Fading the shell as well stacked on top of the overlay and blacked the
    // page out completely.
    expect(background.className).not.toMatch(/opacity-/);
  });
});
