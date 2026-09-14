/**
 * Turns the external catalog's outcome contract (`anilist.ts`) into the state
 * the Add screen renders, and holds the only copy that describes a catalog
 * failure to a member.
 *
 * It exists because the catalog is not our API. `normalizeError` reads the
 * Problem Details envelope of `/v1` (docs/states.md) and speaks about "el
 * servidor"; a read-only third-party catalog that is down is a different
 * situation with a different way out — the manual entry — and its copy would
 * be wrong in both directions if it came from `messages.ts`. What it does
 * borrow is the *shape*: a `NormalizedAppError`, so `ErrorState` and
 * `RetryButton` render it exactly like every other failure in the app and
 * nothing downstream learns that this one arrived by another road.
 *
 * One module, one copy map. A component that branched on
 * `CatalogSearchOutcome` itself would be the "mapa de copia propio" that
 * docs/states.md bans, and there would be one per screen the day the other
 * five categories arrive.
 *
 * Temporary, like the client it adapts: when `/v1/works` owns the catalog
 * integration (epic #10), the outcomes become ordinary API problems and this
 * file is deleted with `anilist.ts`.
 */

import type { ErrorKind, NormalizedAppError } from "@/shared/errors/types";
import type { CatalogSearchOutcome, CatalogSearchResult } from "./anilist";

export type CatalogSearchViewState =
  | { kind: "idle" }
  | { kind: "results"; results: CatalogSearchResult[] }
  | { kind: "no_results"; query: string }
  | { kind: "error"; error: NormalizedAppError };

/**
 * Both failures are transitory and the search is a plain read, so repeating
 * it is always safe: `recovery: "retry"` every time, which `ErrorState` turns
 * into the shared `RetryButton` (a `router.refresh()`, i.e. the same search
 * again — the term lives in the URL).
 *
 * `code: "unknown"` is not laziness: `ProblemCode` is derived from our own
 * contract, and a catalog that is down has no code in it. `KIND_COPY` would
 * answer "No hay conexión con el servidor" for that pair, which is why the
 * copy is written here instead of resolved there.
 */
function catalogError(
  kind: Extract<ErrorKind, "rate_limited" | "service_unavailable">,
  copy: { title: string; description: string },
  retryAfter?: number,
): NormalizedAppError {
  return {
    kind,
    severity: "warning",
    scope: "section",
    code: "unknown",
    retryable: true,
    retryAfter,
    copy,
    recovery: { kind: "retry" },
  };
}

const RATE_LIMITED_COPY = {
  title: "Demasiadas búsquedas seguidas",
  description:
    "El catálogo externo ha pedido una pausa. Espera unos segundos y vuelve a intentarlo, o da la obra de alta a mano.",
};

const UNAVAILABLE_COPY = {
  title: "El catálogo externo no responde",
  description:
    "No hemos podido buscar ahora mismo. Vuelve a intentarlo en un momento, o da la obra de alta a mano.",
};

/**
 * `outcome` is `null` when no search was run at all, which is not the same as
 * a search that came back with nothing: the first is an invitation to type,
 * the second is a dead end that quotes the term back (docs/states.md, «Estados
 * vacíos, por motivo»).
 */
export function catalogSearchState(
  query: string,
  outcome: CatalogSearchOutcome | null,
): CatalogSearchViewState {
  const search = query.trim();
  if (search === "" || outcome === null) {
    return { kind: "idle" };
  }

  switch (outcome.status) {
    case "ok":
      return { kind: "results", results: outcome.results };
    case "empty":
      return { kind: "no_results", query: search };
    case "rate_limited":
      return {
        kind: "error",
        error: catalogError(
          "rate_limited",
          RATE_LIMITED_COPY,
          outcome.retryAfterSeconds,
        ),
      };
    case "unavailable":
      return {
        kind: "error",
        error: catalogError("service_unavailable", UNAVAILABLE_COPY),
      };
  }
}

/**
 * What the polite live region says once a search settles. An error is left
 * out on purpose: `ErrorState` is announced by its own heading, and counting
 * it here would read the same failure twice.
 */
export function catalogSearchAnnouncement(
  state: CatalogSearchViewState,
): string {
  switch (state.kind) {
    case "results":
      return state.results.length === 1
        ? "1 resultado."
        : `${state.results.length} resultados.`;
    case "no_results":
      return "Sin resultados.";
    default:
      return "";
  }
}
