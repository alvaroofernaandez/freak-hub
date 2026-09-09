import { render, screen } from "@testing-library/react";
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
});
