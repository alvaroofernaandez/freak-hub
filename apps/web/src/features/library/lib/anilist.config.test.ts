import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `anilist.ts` reads `ANILIST_API_URL` at request time, and its contract
 * turns every failure into a state instead of an exception — which means a
 * variable that never reaches the running app degrades into a permanent,
 * silent `unavailable` with nothing to grep for.
 *
 * Next loads env files from the app directory, not from the monorepo root
 * (verified with this repo's own `@next/env`: `loadEnvConfig("apps/web")`
 * does not see the root file). `pnpm dev` runs `next dev` with its cwd in
 * `apps/web`, so the root `.env.example` alone is documentation nobody's
 * runtime reads. These two files are where the value has to be declared.
 */
const WEB = join(__dirname, "../../../..");
const ROOT = join(WEB, "../..");

const VARIABLE = "ANILIST_API_URL";

describe("AniList endpoint configuration", () => {
  it("is documented in the web app's own env example", () => {
    const example = readFileSync(join(WEB, ".env.example"), "utf8");

    expect(example).toContain(`${VARIABLE}=https://graphql.anilist.co`);
  });

  it("is documented in the root env example", () => {
    const example = readFileSync(join(ROOT, ".env.example"), "utf8");

    expect(example).toContain(`${VARIABLE}=https://graphql.anilist.co`);
  });

  it("reaches the web container, which only sees what compose forwards", () => {
    const compose = readFileSync(join(ROOT, "docker-compose.yml"), "utf8");
    const web = compose.slice(compose.indexOf("\n  web:"));

    expect(web).toContain(`${VARIABLE}: \${${VARIABLE}`);
  });
});
