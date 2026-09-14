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
 * A function, not a constant, and that is the whole subtlety. Playwright
 * collects every test file *before* it runs the global setup, so a module-scope
 * `test.skip(...)` is decided at a moment when `clerkSetup()` has not been
 * called and `CLERK_TESTING_TOKEN` does not exist yet — measured: the gate read
 * `true` inside the test body while every test had already been marked skipped
 * during collection. Called from a `beforeEach`, it reads the environment the
 * setup actually left behind.
 *
 * The token is the stricter half on purpose. Checking the *secret key* instead
 * would pass with a key that is present but rotated, or pointed at an instance
 * that is down, and every signed-in test would then fail on bot protection
 * rather than skip.
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

let apiProbe: Promise<boolean> | undefined;

/**
 * Two of the invitation journeys cross the whole chain — `getToken()` →
 * `Authorization` → JWKS → Go — so they need the API up with its database
 * behind it. When it is not, they skip with a message that names what is
 * missing instead of failing as if the web app were broken.
 */
export function apiIsReachable(): Promise<boolean> {
  apiProbe ??= fetch(`${apiBaseUrl}/healthz`, {
    signal: AbortSignal.timeout(2_000),
  })
    .then((response) => response.ok)
    .catch(() => false);

  return apiProbe;
}
