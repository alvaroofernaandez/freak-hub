import { normalizeError } from "@/shared/errors/normalize-error";
import { reportError } from "@/shared/errors/report-error";
import type { ErrorScope, NormalizedAppError } from "@/shared/errors/types";
import { apiFetch } from "@/shared/lib/api-client";

/**
 * What a server component gets back from one read.
 *
 * `ViewState`'s third branch, `empty`, is deliberately missing: a GET either
 * answers or fails, and "the list came back with nothing in it" is a `ready`
 * result whose `items` are empty, not a third outcome. The component that
 * renders the list is the one that decides what empty looks like, with the
 * reason-specific copy docs/states.md asks for.
 */
export type LoadResult<T> =
  | { status: "ready"; data: T }
  | { status: "error"; error: NormalizedAppError };

export type LoadResourceOptions = {
  /** Clerk session token, straight from `await auth()`'s `getToken()`. */
  token: string | null;
  /** What is being loaded, in the word a person would use: "tu biblioteca". */
  resource: string;
  /** Where the failure happened, for `reportError`. */
  route: string;
  /** Defaults to `"page"`; pass `"section"` when the rest of the page survives. */
  scope?: ErrorScope;
};

/**
 * One GET, normalized (ADR-0014, docs/states.md).
 *
 * Every server page that reads the API does the same four things: fetch,
 * catch, `normalizeError`, `reportError`. Writing that by hand once per page
 * is how a `catch { return null }` eventually slips in and turns a failure
 * into an empty list — the first anti-pattern docs/states.md lists. This is
 * the single place that shape lives.
 */
export async function loadResource<T>(
  path: string,
  { token, resource, route, scope = "page" }: LoadResourceOptions,
): Promise<LoadResult<T>> {
  try {
    return { status: "ready", data: await apiFetch<T>(path, { token }) };
  } catch (cause) {
    const normalized = normalizeError(cause, {
      resource,
      operation: "load",
      scope,
    });
    reportError(normalized, { route });

    return { status: "error", error: normalized };
  }
}
