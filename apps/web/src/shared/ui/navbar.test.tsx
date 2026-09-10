import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { navLinks } from "@/shared/lib/nav-links";
import {
  AddCategoryModalHost,
  AddCategoryModalProvider,
} from "./add-category-modal";
import { Navbar } from "./navbar";

const pathname = vi.fn(() => "/inicio");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => pathname(),
}));

const offlineNoticeVisible = vi.fn(() => false);
vi.mock("@/shared/lib/use-offline-notice-visible", () => ({
  useOfflineNoticeVisible: () => ({
    online: !offlineNoticeVisible(),
    visible: offlineNoticeVisible(),
  }),
}));

function renderWithAddCategoryModal() {
  return render(
    <AddCategoryModalProvider>
      <Navbar />
      <AddCategoryModalHost />
    </AddCategoryModalProvider>,
  );
}

describe("Navbar", () => {
  afterEach(() => {
    offlineNoticeVisible.mockReturnValue(false);
  });

  it("gives every top-level link an icon, not just a word", () => {
    render(<Navbar />);

    const topNav = screen.getByRole("navigation", {
      name: /navegación principal/i,
    });

    for (const link of navLinks) {
      const anchor = within(topNav).getByRole("link", { name: link.label });
      expect(anchor.querySelector("svg")).not.toBeNull();
    }
  });

  it("gives the mobile bottom bar icons too, where they matter most", () => {
    render(<Navbar />);

    const bottomNav = screen.getByRole("navigation", {
      name: /navegación inferior/i,
    });

    for (const link of within(bottomNav).getAllByRole("link")) {
      expect(link.querySelector("svg")).not.toBeNull();
    }
  });

  it("lets a keyboard user skip the whole navigation", () => {
    render(<Navbar />);

    expect(
      screen.getByRole("link", { name: /saltar al contenido/i }),
    ).toHaveAttribute("href", "#contenido");
  });

  it("marks the section you are looking at, for sighted and assistive users alike", () => {
    pathname.mockReturnValue("/miembros");
    render(<Navbar />);

    const topNav = screen.getByRole("navigation", {
      name: /navegación principal/i,
    });
    const group = within(topNav).getByRole("link", { name: "Grupo" });
    const home = within(topNav).getByRole("link", { name: "Inicio" });

    expect(group).toHaveAttribute("aria-current", "page");
    expect(home).not.toHaveAttribute("aria-current");
  });

  it("keeps the section marked while you are deeper inside it", () => {
    pathname.mockReturnValue("/miembros/alvaro");
    render(<Navbar />);

    const topNav = screen.getByRole("navigation", {
      name: /navegación principal/i,
    });
    expect(within(topNav).getByRole("link", { name: "Grupo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("answers the pointer on every navigation link, wordmark included", () => {
    render(<Navbar />);

    const topNav = screen.getByRole("navigation", {
      name: /navegación principal/i,
    });

    for (const link of within(topNav).getAllByRole("link")) {
      expect(link.className).toMatch(/hover:/);
    }
  });

  it("answers the pointer on the mobile bottom bar too", () => {
    render(<Navbar />);

    const bottomNav = screen.getByRole("navigation", {
      name: /navegación inferior/i,
    });

    for (const link of within(bottomNav).getAllByRole("link")) {
      expect(link.className).toMatch(/hover:/);
    }
  });

  it("keeps the header pinned to the top while the page scrolls", () => {
    render(<Navbar />);

    const header = screen.getByRole("banner");

    expect(header).toHaveClass("sticky");
    expect(header).toHaveClass("top-0");
    // Sticky sits below the modal layer (z-50) so dialogs still cover the header.
    expect(header).toHaveClass("z-30");
    // A translucent header would let scrolled content bleed through it.
    expect(header).toHaveClass("bg-ground");
  });

  it("sticks below the offline banner instead of overlapping it while the banner is visible", () => {
    offlineNoticeVisible.mockReturnValue(true);
    render(<Navbar />);

    const header = screen.getByRole("banner");

    expect(header).toHaveClass("sticky");
    expect(header).toHaveClass("top-9");
    expect(header).not.toHaveClass("top-0");
  });

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
