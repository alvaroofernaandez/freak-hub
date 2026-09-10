import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SECTION_LABELS, SECTION_ORDER, SectionTabs } from "./section-tabs";

const SECTIONS = {
  library: <p>Contenido de biblioteca</p>,
  activity: <p>Contenido de actividad</p>,
  top: <p>Contenido de top</p>,
  recommendations: <p>Contenido de recomendaciones</p>,
};

describe("SECTION_ORDER and SECTION_LABELS", () => {
  it("lists the four sections in the canonical order with a Spanish label", () => {
    expect(SECTION_ORDER).toEqual([
      "library",
      "activity",
      "top",
      "recommendations",
    ]);
    for (const id of SECTION_ORDER) {
      expect(SECTION_LABELS[id]).toMatch(/\S/);
    }
  });
});

describe("SectionTabs", () => {
  it("renders the tabs in the order the member chose", () => {
    render(
      <SectionTabs
        order={["top", "library"]}
        visibleSections={["library", "top"]}
        defaultSection="top"
        sections={SECTIONS}
      />,
    );

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Top",
      "Biblioteca",
    ]);
  });

  it("an unselected tab answers the pointer; the selected one has nothing to offer", () => {
    render(
      <SectionTabs
        visibleSections={["library", "top"]}
        defaultSection="library"
        sections={SECTIONS}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    const selected = tabs.find(
      (tab) => tab.getAttribute("aria-selected") === "true",
    );
    const unselected = tabs.find(
      (tab) => tab.getAttribute("aria-selected") !== "true",
    );

    expect(unselected).toHaveClass("hover:text-ink");
    expect(selected).not.toHaveClass("hover:text-ink");
  });

  it("renders a tab for each visible section, in canonical order", () => {
    render(
      <SectionTabs
        visibleSections={["library", "top"]}
        defaultSection="library"
        sections={SECTIONS}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Biblioteca", "Top"]);
  });

  it("shows the content of the default section initially", () => {
    render(
      <SectionTabs
        visibleSections={SECTION_ORDER}
        defaultSection="top"
        sections={SECTIONS}
      />,
    );

    expect(screen.getByText("Contenido de top")).toBeInTheDocument();
    expect(
      screen.queryByText("Contenido de biblioteca"),
    ).not.toBeInTheDocument();
  });

  it("switches content when another tab is clicked", async () => {
    const user = userEvent.setup();
    render(
      <SectionTabs
        visibleSections={SECTION_ORDER}
        defaultSection="library"
        sections={SECTIONS}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Actividad" }));

    expect(screen.getByText("Contenido de actividad")).toBeInTheDocument();
    expect(
      screen.queryByText("Contenido de biblioteca"),
    ).not.toBeInTheDocument();
  });

  it("marks only the active tab with the sliding indicator element", () => {
    render(
      <SectionTabs
        visibleSections={["library", "top"]}
        defaultSection="library"
        sections={SECTIONS}
      />,
    );

    const tabs = screen.getAllByRole("tab");
    const active = tabs.find(
      (tab) => tab.getAttribute("aria-selected") === "true",
    ) as HTMLElement;
    const inactive = tabs.find(
      (tab) => tab.getAttribute("aria-selected") !== "true",
    ) as HTMLElement;

    expect(
      within(active).getByTestId("section-tab-indicator"),
    ).toBeInTheDocument();
    expect(
      within(inactive).queryByTestId("section-tab-indicator"),
    ).not.toBeInTheDocument();
  });

  it("scopes the sliding indicator's layoutId per instance, so two tab lists on one page never share it", () => {
    // Two `SectionTabs` on the same page (e.g. own profile + a friend's, or
    // a future split view) used to share the literal layoutId
    // "section-tab-indicator". Motion's layout system treats a shared
    // layoutId as the *same* element across every instance that renders it,
    // so the two indicators would try to morph into one another instead of
    // moving independently. Each instance must carry its own scope.
    render(
      <>
        <SectionTabs
          visibleSections={["library", "top"]}
          defaultSection="library"
          sections={SECTIONS}
        />
        <SectionTabs
          visibleSections={["library", "top"]}
          defaultSection="library"
          sections={SECTIONS}
        />
      </>,
    );

    const groups = screen.getAllByTestId("section-tabs");
    expect(groups).toHaveLength(2);
    const [first, second] = groups;
    const firstId = first.getAttribute("data-layout-group");
    const secondId = second.getAttribute("data-layout-group");
    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);
  });

  it("enters the new section's content from the side moved toward: forward when picking a later tab, backward when picking an earlier one", async () => {
    // Direction-aware tab content (ADR-0013, adapted from Cult UI's
    // DirectionAwareTabs): moving to a tab further right in the visible
    // order enters its content from the right (direction 1); moving to one
    // further left enters from the left (direction -1).
    const user = userEvent.setup();
    render(
      <SectionTabs
        visibleSections={SECTION_ORDER}
        defaultSection="library"
        sections={SECTIONS}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "Top" }));
    expect(screen.getByTestId("section-tab-content")).toHaveAttribute(
      "data-direction",
      "1",
    );

    await user.click(screen.getByRole("tab", { name: "Biblioteca" }));
    expect(screen.getByTestId("section-tab-content")).toHaveAttribute(
      "data-direction",
      "-1",
    );
  });

  it("does not animate a height on the tabpanel wrapper", () => {
    render(
      <SectionTabs
        visibleSections={SECTION_ORDER}
        defaultSection="library"
        sections={SECTIONS}
      />,
    );

    const panel = screen.getByRole("tabpanel");
    expect(panel.style.height).toBe("");
  });

  it("does not block a second tab click while the section change is still settling", async () => {
    const user = userEvent.setup();
    render(
      <SectionTabs
        visibleSections={SECTION_ORDER}
        defaultSection="library"
        sections={SECTIONS}
      />,
    );

    const activityTab = screen.getByRole("tab", { name: "Actividad" });
    const topTab = screen.getByRole("tab", { name: "Top" });
    expect(activityTab).not.toHaveAttribute("disabled");
    expect(topTab).not.toHaveAttribute("disabled");

    await user.click(activityTab);
    await user.click(topTab);

    expect(screen.getByText("Contenido de top")).toBeInTheDocument();
  });

  it("falls back to the first visible section when the default is not visible", () => {
    render(
      <SectionTabs
        visibleSections={["top", "recommendations"]}
        defaultSection="library"
        sections={SECTIONS}
      />,
    );

    expect(screen.getByText("Contenido de top")).toBeInTheDocument();
  });

  describe("WAI-ARIA APG tabs pattern", () => {
    it("connects each tab to its tabpanel with unique, matching ids", () => {
      render(
        <SectionTabs
          visibleSections={["library", "top"]}
          defaultSection="library"
          sections={SECTIONS}
        />,
      );

      const activeTab = screen.getByRole("tab", { name: "Biblioteca" });
      const panel = screen.getByRole("tabpanel");

      expect(activeTab).toHaveAttribute("aria-controls", panel.id);
      expect(panel).toHaveAttribute("aria-labelledby", activeTab.id);
      expect(activeTab.id).toBeTruthy();
      expect(panel.id).toBeTruthy();
    });

    it("scopes tab/tabpanel ids per instance, so two tab lists on one page never collide", () => {
      render(
        <>
          <SectionTabs
            visibleSections={["library", "top"]}
            defaultSection="library"
            sections={SECTIONS}
          />
          <SectionTabs
            visibleSections={["library", "top"]}
            defaultSection="library"
            sections={SECTIONS}
          />
        </>,
      );

      const [firstTab, secondTab] = screen.getAllByRole("tab", {
        name: "Biblioteca",
      });
      expect(firstTab.id).not.toBe(secondTab.id);
    });

    it("gives only the selected tab a roving tabindex of 0; the rest are -1", () => {
      render(
        <SectionTabs
          visibleSections={SECTION_ORDER}
          defaultSection="library"
          sections={SECTIONS}
        />,
      );

      const tabs = screen.getAllByRole("tab");
      for (const tab of tabs) {
        expect(tab).toHaveAttribute(
          "tabindex",
          tab.getAttribute("aria-selected") === "true" ? "0" : "-1",
        );
      }
    });

    it("moves focus and selection to the next tab on ArrowRight, and back on ArrowLeft", async () => {
      const user = userEvent.setup();
      render(
        <SectionTabs
          visibleSections={SECTION_ORDER}
          defaultSection="library"
          sections={SECTIONS}
        />,
      );

      screen.getByRole("tab", { name: "Biblioteca" }).focus();
      await user.keyboard("{ArrowRight}");

      const activity = screen.getByRole("tab", { name: "Actividad" });
      expect(activity).toHaveFocus();
      expect(activity).toHaveAttribute("aria-selected", "true");

      await user.keyboard("{ArrowLeft}");
      const library = screen.getByRole("tab", { name: "Biblioteca" });
      expect(library).toHaveFocus();
      expect(library).toHaveAttribute("aria-selected", "true");
    });

    it("wraps from the last tab to the first on ArrowRight", async () => {
      const user = userEvent.setup();
      render(
        <SectionTabs
          visibleSections={["library", "top"]}
          defaultSection="top"
          sections={SECTIONS}
        />,
      );

      screen.getByRole("tab", { name: "Top" }).focus();
      await user.keyboard("{ArrowRight}");

      const library = screen.getByRole("tab", { name: "Biblioteca" });
      expect(library).toHaveFocus();
      expect(library).toHaveAttribute("aria-selected", "true");
    });

    it("jumps to the first tab on Home and the last on End", async () => {
      const user = userEvent.setup();
      render(
        <SectionTabs
          visibleSections={SECTION_ORDER}
          defaultSection="library"
          sections={SECTIONS}
        />,
      );

      screen.getByRole("tab", { name: "Biblioteca" }).focus();
      await user.keyboard("{End}");
      const recommendations = screen.getByRole("tab", {
        name: "Recomendaciones",
      });
      expect(recommendations).toHaveFocus();
      expect(recommendations).toHaveAttribute("aria-selected", "true");

      await user.keyboard("{Home}");
      const library = screen.getByRole("tab", { name: "Biblioteca" });
      expect(library).toHaveFocus();
      expect(library).toHaveAttribute("aria-selected", "true");
    });
  });
});
