import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceFilesContaining } from "./source-scan";

const SRC = join(__dirname, "..");

/**
 * The high-fidelity mockup draws every screen three times, at 390, 1024 and
 * 1440 px, and the components follow that ladder: base for the phone, `md:`
 * for the tablet, one last step for the desktop. That last step used to be
 * `lg:`, which Tailwind starts at 1024 px — exactly the width of the tablet
 * artboard, so the tablet variant only ever existed between 768 and 1023 px
 * and never rendered at the width it was drawn for. Desktop starts at `xl:`
 * (1280 px) instead, which puts one reference width inside each variant
 * (docs/design.md#la-cabecera-existe-en-las-tres-anchuras).
 *
 * The guard is on the source because jsdom applies no stylesheet and cannot
 * tell which breakpoint won.
 */
const ALLOWED = [
  /*
   * Not a step of that ladder: the `@usuario` handle appears when the header
   * row has room for it, which happens to be 1024 px. Neither artboard draws
   * a handle at all, so there is no tablet/desktop value to follow here.
   */
  "src/features/members/ui/user-menu.tsx",
];

describe("desktop breakpoint", () => {
  it("is xl:, never lg:, so 1024 px renders the tablet variant", () => {
    const offenders = sourceFilesContaining("lg:", SRC)
      .map((path) => relative(join(SRC, ".."), path).replaceAll("\\", "/"))
      .filter((path) => !ALLOWED.includes(path));

    expect(offenders).toEqual([]);
  });
});
