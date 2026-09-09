import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceFilesContaining } from "./source-scan";

const SRC = join(__dirname, "..");

/**
 * Icons come from one set (reicon-react). Typographic glyphs borrowed from the
 * body font carry the text font's metrics and weight, so they never line up
 * with each other or with real icons.
 *
 * This lists the glyphs that used to be in the source. It guards against a
 * regression, not against the characters appearing in prose.
 */
const RETIRED_GLYPHS = ["☆", "○", "◐", "●", "✕", "❚❚", "★", "◆", "✉", "‹", "⚙"];

describe("icon set", () => {
  it.each(
    RETIRED_GLYPHS,
  )("no longer renders the %s glyph as an icon", (glyph) => {
    expect(sourceFilesContaining(glyph, SRC)).toEqual([]);
  });
});
