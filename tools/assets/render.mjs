// Renders the README hero and the social/OG image from banner.html.
//
//   pnpm --filter @freak-hub/web exec node ../../tools/assets/render.mjs
//
// The hero keeps its alpha corners so it sits well on both GitHub themes.
// The OG card is opaque: social platforms re-encode to JPEG and would turn
// transparency into black fringing.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const page_url = `file://${path.join(here, "banner.html")}`;
const out = path.join(here, "..", "..", "docs", "assets");

const targets = [
  { id: "hero", file: "hero.png", omitBackground: true, scale: 1 },
  { id: "og", file: "og.png", omitBackground: false, scale: 1 },
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 2500, height: 1500 },
  deviceScaleFactor: 1,
});
await page.goto(page_url, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

for (const { id, file, omitBackground } of targets) {
  const element = page.locator(`#${id}`);
  await element.screenshot({ path: path.join(out, file), omitBackground });
  const box = await element.boundingBox();
  console.log(`${file}  ${Math.round(box.width)}x${Math.round(box.height)}`);
}

await browser.close();
