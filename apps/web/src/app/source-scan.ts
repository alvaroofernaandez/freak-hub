import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Walks the app's source, skipping tests. Used by the guard tests that assert
 * on the source itself, because jsdom applies no stylesheet and so cannot
 * verify a colour token or a cursor rule by rendering.
 *
 * Implemented with node:fs rather than by shelling out to ripgrep: a guard
 * that depends on a tool being installed fails for the wrong reason on CI.
 */
export function sourceFilesContaining(needle: string, root: string): string[] {
  const hits: string[] = [];

  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".")) {
        continue;
      }

      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
        continue;
      }

      if (
        /\.(test|spec)\.[jt]sx?$/.test(entry) ||
        !/\.[jt]sx?$|\.css$/.test(entry)
      ) {
        continue;
      }

      if (readFileSync(path, "utf8").includes(needle)) {
        hits.push(path);
      }
    }
  }

  walk(root);
  return hits;
}
