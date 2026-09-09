import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

/**
 * `--ink-faint` reaches 3.07:1 on `--ground` and only 2.52:1 on
 * `--surface-raised`, so it fails WCAG AA (4.5:1) as text on every surface
 * this app uses (the measured table lives in docs/design.md).
 *
 * It stays available for borders and for decoration that is already hidden
 * from assistive tech. Anything a person has to read uses `--ink-muted`
 * (6.16:1 at worst) or better.
 */
function grepInkFaintText(): string[] {
  try {
    const out = execSync(
      `rg -n --glob '!*.test.*' -e 'text-ink-faint' -e 'placeholder:text-ink-faint' ${SRC}`,
      { encoding: "utf8" },
    );
    return out.trim().split("\n").filter(Boolean);
  } catch {
    // rg exits non-zero when there are no matches, which is the passing case.
    return [];
  }
}

describe("token contrast", () => {
  it("never paints readable text with --ink-faint", () => {
    expect(grepInkFaintText()).toEqual([]);
  });
});
