import { fileURLToPath } from "node:url";
import { test } from "@playwright/test";

/**
 * Everything the signed-in Playwright projects need to know about the test
 * user, kept in one place so a spec never reads `process.env` directly and
 * every skip message says the same thing.
 *
 * Nothing here carries a value: the credentials belong to a real Clerk
 * instance, so they arrive through the environment and are documented —
 * without values — in `.env.example`.
 */

/** Where the signed-in session is parked. Git-ignored: it is a real session. */
export const STORAGE_STATE = fileURLToPath(
  new URL("../../playwright/.clerk/user.json", import.meta.url),
);

/** Identifier of the dedicated test user (an email or a username). */
export const testUserIdentifier = process.env.E2E_CLERK_USER_IDENTIFIER ?? "";

/**
 * Its password — optional, and a fallback rather than the default. On Freak
 * Hub's development instance a password sign-in stops at `needs_client_trust`
 * and never yields a session in a fresh browser; `sign-in.ts` explains the
 * measurement. Only an identifier that is not a `+clerk_test` address needs it.
 */
export const testUserPassword = process.env.E2E_CLERK_USER_PASSWORD ?? "";

/**
 * Why the signed-in tests cannot run, or `null` when they can.
 *
 * A function rather than a module-scope constant, so the environment is read at
 * the latest possible moment and the answer can never be stale. That is defence
 * in depth, not a workaround for a known ordering bug — an earlier version of
 * this file claimed Playwright collects test files before running the global
 * setup, and that claim was wrong. In `playwright@1.62.1`
 * (`lib/runner/index.js`) the global setup tasks are created *before* the load
 * task, and probing confirms it: `CLERK_TESTING_TOKEN` reads back set at module
 * scope during load, whether read directly, through this module, or as a
 * constant. Only `--list` loads first, and it runs no global setup.
 *
 * (The run that prompted the change did mark all six skipped while the gate
 * read `true` inside a test body. Neither load order nor a stale module cache
 * explains it, and it has not been reproduced since. The hook shape is the one
 * that cannot go stale either way, so it stays.)
 *
 * The token is the stricter half of the check, on purpose. Testing the *secret
 * key* instead would pass with a key that is present but rotated, or pointed at
 * an instance that is down, and every signed-in test would then fail on bot
 * protection rather than skip.
 */
export function missingSessionReason(): string | null {
  if (!testUserIdentifier) {
    return "Sin E2E_CLERK_USER_IDENTIFIER: no hay usuario de prueba con el que iniciar sesión (ver docs/testing.md).";
  }

  if (!process.env.CLERK_TESTING_TOKEN) {
    return "clerkSetup() no consiguió un testing token de Clerk: revisa CLERK_SECRET_KEY (ver docs/testing.md).";
  }

  return null;
}

/**
 * Drop-in `beforeEach` for every signed-in spec. Declare it before any hook
 * that touches `context` or `page`: fixtures are created lazily, so skipping
 * first means no browser is launched for a test that is not going to run.
 */
export function skipWithoutTestSession(): void {
  const reason = missingSessionReason();
  test.skip(reason !== null, reason ?? "");
}

/**
 * The address the invitation journeys use. `+clerk_test` is Clerk's own
 * convention for an address it will never actually deliver to, so a run does
 * not put mail in a stranger's inbox; the timestamp keeps each run from
 * colliding with the pending invitation the previous one left behind.
 */
export function inviteeEmail(): string {
  const override = process.env.E2E_INVITEE_EMAIL?.trim();
  if (override) {
    return override;
  }

  return `freak-hub-e2e-${Date.now()}+clerk_test@example.com`;
}

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ??
  "http://localhost:8080";

export const MISSING_API = `La API en Go no responde en ${apiBaseUrl}: los recorridos que la atraviesan no se pueden probar (ver docs/testing.md).`;

const UNREACHABLE_API = `La API en Go no responde en ${apiBaseUrl} y E2E_REQUIRE_API está activo: este entorno se comprometió a tenerla en pie.`;

let apiProbe: Promise<boolean> | undefined;

function probeApi(): Promise<boolean> {
  apiProbe ??= fetch(`${apiBaseUrl}/healthz`, {
    signal: AbortSignal.timeout(2_000),
  })
    .then((response) => response.ok)
    .catch(() => false);

  return apiProbe;
}

/**
 * Gate for the two journeys that cross into the Go API.
 *
 * Skipping is right on a laptop, where not everyone has Postgres up. In CI it
 * would be a lie: the job starts the API on purpose, so if the probe fails
 * there something broke — and a skip would let the exact coverage this suite
 * exists for vanish behind a green tick, since that step is advisory. Hence
 * `E2E_REQUIRE_API`, which the workflow sets: unreachable then means failure,
 * not absence.
 */
export async function requireApiOrSkip(): Promise<void> {
  if (await probeApi()) {
    return;
  }

  if (process.env.E2E_REQUIRE_API) {
    throw new Error(UNREACHABLE_API);
  }

  test.skip(true, MISSING_API);
}
