import { fileURLToPath } from "node:url";

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
 * Its password — optional, and only usable where the instance accepts a
 * password as a *first factor*. Freak Hub's development instance does not: it
 * signs in with an email code, so the identifier is a `+clerk_test` address and
 * this stays empty. See `sign-in.ts`.
 */
export const testUserPassword = process.env.E2E_CLERK_USER_PASSWORD ?? "";

/**
 * Signing in needs the user's identifier *and* a Clerk secret key, because
 * `clerkSetup()` trades that key for the testing token that gets the run past
 * bot protection. Missing either is a skip, never a failure: a fork's pull
 * request has no access to the instance and should not be told it broke
 * something it cannot reach.
 */
export const hasSignedInCredentials = Boolean(
  testUserIdentifier && process.env.CLERK_SECRET_KEY,
);

export const MISSING_CREDENTIALS =
  "Sin credenciales del usuario de prueba: define E2E_CLERK_USER_IDENTIFIER y " +
  "CLERK_SECRET_KEY (y E2E_CLERK_USER_PASSWORD si tu instancia inicia sesión " +
  "con contraseña). Ver docs/testing.md.";

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
