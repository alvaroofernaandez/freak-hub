/**
 * Route classification shared by the Clerk middleware and the navigation layer.
 *
 * Everything is protected by default. A route only becomes reachable without a
 * session when it is listed here, so adding a page never accidentally exposes it.
 *
 * Clerk's own sub-flows (email verification, second factor, invitation tickets)
 * live under /entrar and /registro, which is why those are prefix matches.
 * Webhooks are NOT here: Clerk delivers them straight to the Go API, which
 * verifies the Svix signature itself.
 */
const PUBLIC_ROUTE_PREFIXES = ["/entrar", "/registro"] as const;

const PUBLIC_EXACT_ROUTES = ["/"] as const;

export function isPublicRoute(pathname: string): boolean {
  if (
    PUBLIC_EXACT_ROUTES.includes(
      pathname as (typeof PUBLIC_EXACT_ROUTES)[number],
    )
  ) {
    return true;
  }

  return PUBLIC_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** Clerk's `createRouteMatcher` expects glob patterns, not predicates. */
export const publicRouteMatchers = [
  ...PUBLIC_EXACT_ROUTES,
  ...PUBLIC_ROUTE_PREFIXES.map((prefix) => `${prefix}(.*)`),
];
