import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

/**
 * Icons come from one set (reicon-react). Typographic glyphs borrowed from the
 * body font were the previous approach: they carry the text font's metrics and
 * weight, so they never line up with each other or with real icons.
 *
 * This lists the glyphs that used to be in the source. It is a regression
 * guard, not a ban on the characters themselves in prose.
 */
const RETIRED_GLYPHS = ["☆", "○", "◐", "●", "✕", "❚❚", "★", "◆", "✉", "‹"];

describe("icon set", () => {
  it.each(
    RETIRED_GLYPHS,
  )("no longer renders the %s glyph as an icon", (glyph) => {
    let matches: string[] = [];
    try {
      matches = execSync(
        `rg -l --glob '!*.test.*' -F ${JSON.stringify(glyph)} ${SRC}`,
        { encoding: "utf8" },
      )
        .trim()
        .split("\n")
        .filter(Boolean);
    } catch {
      // rg exits non-zero when nothing matches, which is the passing case.
    }
    expect(matches).toEqual([]);
  });
});
