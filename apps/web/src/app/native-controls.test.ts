import { execSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

/**
 * Native `<select>`, checkboxes and radios paint their popup and their box
 * with the operating system's colours, which on this dark surface arrive as a
 * bright panel belonging to nothing around it. The app uses Radix primitives
 * styled with the project's own tokens instead (shared/ui/select.tsx,
 * shared/ui/checkbox.tsx).
 */
const NATIVE_CONTROLS = ["<select", 'type="checkbox"', 'type="radio"'];

describe("native form controls", () => {
  it.each(NATIVE_CONTROLS)("no longer renders %s", (control) => {
    let matches: string[] = [];
    try {
      matches = execSync(
        `rg -l --glob '!*.test.*' -F ${JSON.stringify(control)} ${SRC}`,
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
