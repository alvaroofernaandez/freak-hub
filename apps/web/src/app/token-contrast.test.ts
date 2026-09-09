import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceFilesContaining } from "./source-scan";

const SRC = join(__dirname, "..");

/**
 * `--ink-faint` reaches 3.07:1 on `--ground` and only 2.52:1 on
 * `--surface-raised`, so it fails WCAG AA (4.5:1) as text on every surface
 * this app uses (the measured table lives in docs/design.md).
 *
 * It stays available for borders and backgrounds. Anything a person has to
 * read uses `--ink-muted` (6.16:1 at worst) or better.
 */
describe("token contrast", () => {
  it("never paints readable text with --ink-faint", () => {
    expect(sourceFilesContaining("text-ink-faint", SRC)).toEqual([]);
  });

  it("never uses it for placeholder text either", () => {
    expect(sourceFilesContaining("placeholder:text-ink-faint", SRC)).toEqual(
      [],
    );
  });
});
