import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AddCategoryModalDimmer,
  AddCategoryModalHost,
  AddCategoryModalProvider,
  useAddCategoryModal,
} from "./add-category-modal";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "./category-stripe";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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

  it("flashes the chosen category before navigating, instead of leaving instantly", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const anime = screen.getByRole("button", { name: CATEGORY_LABELS.anime });
    await user.click(anime);

    // The confirmation is visible first, and the route change waits for it.
    expect(anime).toHaveAttribute("data-confirming");
    expect(push).not.toHaveBeenCalled();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/anadir/anime"));
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

  it("renders the six categories in a 3-column grid, without a work count", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Añadir" }));

    const dialog = screen.getByRole("dialog");
    const grid = within(dialog).getByTestId("add-category-modal-grid");
    expect(grid).toHaveClass("grid-cols-3");

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
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
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

  it("dims the background while open", async () => {
    const user = userEvent.setup();
    renderModal();
    const background = screen.getByTestId("add-category-modal-dimmer");

    await user.click(screen.getByRole("button", { name: "Añadir" }));

    expect(background).toHaveClass("opacity-[.32]");
  });
});
