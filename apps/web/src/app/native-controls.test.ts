import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sourceFilesContaining } from "./source-scan";

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
    expect(sourceFilesContaining(control, SRC)).toEqual([]);
  });
});
