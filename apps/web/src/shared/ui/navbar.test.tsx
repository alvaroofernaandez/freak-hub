import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { navLinks } from "@/shared/lib/nav-links";
import {
  AddCategoryModalHost,
  AddCategoryModalProvider,
} from "./add-category-modal";
import { Navbar } from "./navbar";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function renderWithAddCategoryModal() {
  return render(
    <AddCategoryModalProvider>
      <Navbar />
      <AddCategoryModalHost />
    </AddCategoryModalProvider>,
  );
}

describe("Navbar", () => {
  it("links the wordmark to /inicio with the display font", () => {
    render(<Navbar />);

    const wordmark = screen.getByRole("link", { name: "Freak Hub" });
    expect(wordmark).toHaveAttribute("href", "/inicio");
    expect(wordmark).toHaveClass("font-display");
  });

  it("renders the four top-level links with their href", () => {
    render(<Navbar />);

    const topNav = screen.getByRole("navigation", {
      name: /navegación principal/i,
    });

    for (const link of navLinks) {
      expect(
        within(topNav).getByRole("link", { name: link.label }),
      ).toHaveAttribute("href", link.href);
    }
  });

  it("opens the add-category modal from the desktop add button, instead of navigating", async () => {
    const user = userEvent.setup();
    renderWithAddCategoryModal();

    const topNav = screen.getByRole("navigation", {
      name: /navegación principal/i,
    });
    const addButton = within(topNav).getByRole("button", { name: /añadir/i });
    expect(addButton).not.toHaveAttribute("href");

    await user.click(addButton);

    expect(
      screen.getByRole("dialog", { name: "¿Qué quieres añadir?" }),
    ).toBeInTheDocument();
  });

  it("does not render a badge when there are no pending recommendations", () => {
    render(<Navbar />);

    expect(
      screen.queryByLabelText(/recomendaciones pendientes/i),
    ).not.toBeInTheDocument();
  });

  it("does not render a badge when pendingRecommendations is 0", () => {
    render(<Navbar pendingRecommendations={0} />);

    expect(
      screen.queryByLabelText(/recomendaciones pendientes/i),
    ).not.toBeInTheDocument();
  });

  it("renders an accessible badge when there are pending recommendations", () => {
    render(<Navbar pendingRecommendations={3} />);

    expect(
      screen.getByLabelText("3 recomendaciones pendientes"),
    ).toBeInTheDocument();
  });

  it("renders the user slot", () => {
    render(<Navbar userSlot={<span>slot-de-usuario</span>} />);

    expect(screen.getByText("slot-de-usuario")).toBeInTheDocument();
  });

  it("renders a mobile bottom bar with its five items", () => {
    render(<Navbar />);

    const bottomBar = screen.getByRole("navigation", {
      name: /navegación inferior/i,
    });

    expect(
      within(bottomBar).getByRole("link", { name: "Inicio" }),
    ).toHaveAttribute("href", "/inicio");
    expect(
      within(bottomBar).getByRole("link", { name: "Biblioteca" }),
    ).toHaveAttribute("href", "/biblioteca");
    expect(
      within(bottomBar).getByRole("button", { name: /añadir/i }),
    ).not.toHaveAttribute("href");
    expect(
      within(bottomBar).getByRole("link", { name: "Actividad" }),
    ).toHaveAttribute("href", "/actividad");
    expect(
      within(bottomBar).getByRole("link", { name: /recom/i }),
    ).toHaveAttribute("href", "/recomendaciones");
  });

  it("opens the add-category modal from the mobile FAB, instead of navigating", async () => {
    const user = userEvent.setup();
    renderWithAddCategoryModal();

    const bottomBar = screen.getByRole("navigation", {
      name: /navegación inferior/i,
    });

    await user.click(
      within(bottomBar).getByRole("button", { name: /añadir/i }),
    );

    expect(
      screen.getByRole("dialog", { name: "¿Qué quieres añadir?" }),
    ).toBeInTheDocument();
  });
});
