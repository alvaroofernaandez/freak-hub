import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CatalogAttribution } from "./catalog-attribution";

const CATALOGS: [string, string][] = [
  ["AniList", "https://anilist.co"],
  ["IGDB", "https://igdb.com"],
  ["TMDB", "https://themoviedb.org"],
  ["BoardGameGeek", "https://boardgamegeek.com"],
  ["Scryfall", "https://scryfall.com"],
];

describe("CatalogAttribution", () => {
  it.each(CATALOGS)("credits %s and links to it", (name, href) => {
    render(<CatalogAttribution />);

    expect(
      screen.getByRole("link", { name: new RegExp(name, "i") }),
    ).toHaveAttribute("href", href);
  });

  it("lists them as a list, not as a paragraph of names", () => {
    render(<CatalogAttribution />);

    expect(screen.getAllByRole("listitem")).toHaveLength(CATALOGS.length);
  });

  it("opens them away from the app without leaking the referrer", () => {
    render(<CatalogAttribution />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute(
        "rel",
        expect.stringContaining("noreferrer"),
      );
    }
  });
});
