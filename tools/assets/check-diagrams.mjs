// Parses every ```mermaid block in the repo's Markdown with the real Mermaid
// engine, so a broken diagram fails here instead of rendering as a grey error
// box on GitHub.
//
//   pnpm diagrams:check

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build"]);

async function markdownFiles(dir) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await markdownFiles(full)));
    else if (entry.name.endsWith(".md")) found.push(full);
  }
  return found;
}

const blocks = [];
for (const file of await markdownFiles(root)) {
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/```mermaid\n([\s\S]*?)```/g)) {
    blocks.push({
      file: path.relative(root, file),
      line: source.slice(0, match.index).split("\n").length,
      code: match[1],
    });
  }
}

if (blocks.length === 0) {
  console.log("no mermaid blocks found");
  process.exit(0);
}

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<!doctype html><html><body>
  <script type="module">
    import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
    mermaid.initialize({ startOnLoad: false });
    window.check = async (code) => {
      try { await mermaid.parse(code); return null; }
      catch (error) { return String(error.message ?? error); }
    };
  </script>
</body></html>`);
await page.waitForFunction(() => typeof window.check === "function", {
  timeout: 30_000,
});

let failures = 0;
for (const block of blocks) {
  const error = await page.evaluate((code) => window.check(code), block.code);
  if (error) {
    failures++;
    console.error(`FAIL  ${block.file}:${block.line}\n${error}\n`);
  } else {
    console.log(`ok    ${block.file}:${block.line}`);
  }
}

await browser.close();
console.log(`\n${blocks.length - failures}/${blocks.length} diagrams parse`);
process.exit(failures === 0 ? 0 : 1);
