import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CatalogSearchResult } from "@/features/library/lib/anilist";
import { CatalogSearchResults } from "./catalog-search-results";

const DEATH_NOTE: CatalogSearchResult = {
  id: "anilist:1535",
  title: "Death Note",
  year: 2006,
  coverUrl: "https://example.test/covers/1535.jpg",
  synopsis: "Un cuaderno mata a quien escribes en él.",
};

describe("CatalogSearchResults", () => {
  it("lists one entry per result", () => {
    render(
      <CatalogSearchResults
        results={[DEATH_NOTE, { id: "anilist:21", title: "One Piece" }]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("shows the title, the year and the synopsis of a result", () => {
    render(<CatalogSearchResults results={[DEATH_NOTE]} />);

    expect(screen.getByText("Death Note")).toBeInTheDocument();
    expect(screen.getByText("2006")).toBeInTheDocument();
    expect(
      screen.getByText("Un cuaderno mata a quien escribes en él."),
    ).toBeInTheDocument();
  });

  it("shows the cover the catalog gave", () => {
    render(<CatalogSearchResults results={[DEATH_NOTE]} />);

    expect(screen.getByTestId("catalog-result-cover")).toHaveAttribute(
      "src",
      DEATH_NOTE.coverUrl,
    );
  });

  it("falls back to the striped placeholder instead of a broken image", () => {
    render(
      <CatalogSearchResults
        results={[{ id: "anilist:21", title: "One Piece" }]}
      />,
    );

    expect(
      screen.queryByTestId("catalog-result-cover"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId("catalog-result-cover-placeholder"),
    ).toBeInTheDocument();
  });

  it("leaves out the year rather than printing a placeholder for it", () => {
    render(
      <CatalogSearchResults
        results={[{ id: "anilist:21", title: "One Piece" }]}
      />,
    );

    expect(screen.queryByText(/^—$/)).not.toBeInTheDocument();
    expect(screen.getByText("One Piece")).toBeInTheDocument();
  });

  it("renders the synopsis as text, never as markup", () => {
    render(
      <CatalogSearchResults
        results={[
          {
            id: "anilist:1",
            title: "Cowboy Bebop",
            synopsis: "<b>No</b> es HTML.",
          },
        ]}
      />,
    );

    expect(screen.getByText("<b>No</b> es HTML.")).toBeInTheDocument();
    expect(document.querySelector("b")).toBeNull();
  });

  it("does not offer an add action while there is nowhere to add to", () => {
    render(<CatalogSearchResults results={[DEATH_NOTE]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
