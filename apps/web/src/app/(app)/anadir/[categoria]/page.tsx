import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "reicon-react";
import { searchAnime } from "@/features/library/lib/anilist";
import {
  type CatalogSearchViewState,
  catalogSearchAnnouncement,
  catalogSearchState,
  SEARCH_MAX_LENGTH,
} from "@/features/library/lib/catalog-search";
import { CatalogSearchField } from "@/features/library/ui/catalog-search-field";
import { CatalogSearchResults } from "@/features/library/ui/catalog-search-results";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategoryId,
} from "@/shared/ui/category-stripe";
import { EmptyState } from "@/shared/ui/empty-state";
import { ErrorState } from "@/shared/ui/state/error-state";

type AddSearchPageProps = {
  params: Promise<{ categoria: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** One screenful of hits. Enough to recognise the right entry without turning
 * the step into a catalogue to browse. */
const SEARCH_LIMIT = 10;

function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_ORDER as string[]).includes(value);
}

export async function generateMetadata({
  params,
}: AddSearchPageProps): Promise<Metadata> {
  const { categoria } = await params;
  return { title: isCategoryId(categoria) ? "Añadir" : "" };
}

/**
 * Step two of adding a work: search the category's external catalog
 * (docs/catalogs.md).
 *
 * Only anime has one so far (epic #20; the backend will own all six when
 * `/v1/works` exists, docs/roadmap.md). The other five keep the disabled
 * field and the honest "not built yet" state they had — a "not built yet"
 * state, not an "add your first thing" one, so it carries no action.
 *
 * The search runs *here*, in the server component, on the `q` of the URL, for
 * three reasons:
 *
 * - `ANILIST_API_URL` carries no `NEXT_PUBLIC_` prefix, so the catalog module
 *   is only usable on the server; called from the browser it degrades to
 *   «no disponible» without a single error to explain why.
 * - It is the smallest thing that works. A server action would be a POST that
 *   mutates nothing; a route handler would publish an open proxy to the
 *   catalog on our own origin, spend its shared rate limit on whoever found
 *   the URL, and re-serialise an outcome contract that already exists.
 * - What is on screen becomes a pure function of the URL, which is what keeps
 *   an in-flight search from painting over a newer one: there is no response
 *   arriving late, only the term the URL currently holds. It also means a
 *   search is a link — shareable, bookmarkable, survives a reload.
 */
export default async function AddSearchPage({
  params,
  searchParams,
}: AddSearchPageProps) {
  const { categoria } = await params;

  if (!isCategoryId(categoria)) {
    notFound();
    return;
  }

  const { q } = await searchParams;
  // A repeated `?q=` arrives as an array. Searching for "uno,dos" would be an
  // invention; treating it as no search at all is the honest reading.
  // Capped here, not only in the field: `?q=` is reachable by hand and by a
  // shared link, so the field's own `maxLength` protects nobody but the
  // person typing.
  const query =
    typeof q === "string" ? q.trim().slice(0, SEARCH_MAX_LENGTH) : "";
  const isAnime = categoria === "anime";

  const state = isAnime
    ? catalogSearchState(
        query,
        query === "" ? null : await searchAnime(query, { limit: SEARCH_LIMIT }),
      )
    : null;

  return (
    <section
      data-testid="add-search-content"
      className="max-w-[820px] space-y-6"
    >
      <Link
        href="/biblioteca"
        className="text-sm font-semibold text-ink-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">
          Añadir · {CATEGORY_LABELS[categoria]}
        </h1>
        <p className="text-ink-muted">
          Busca en el catálogo externo de esta categoría.
        </p>
      </div>

      {state ? (
        <CatalogSearchField
          query={query}
          announcement={catalogSearchAnnouncement(state)}
        >
          <CatalogSearchBody state={state} />
        </CatalogSearchField>
      ) : (
        <>
          <input
            type="search"
            disabled
            placeholder="Buscar…"
            aria-label="Buscar en el catálogo externo"
            className="w-full max-w-md rounded-lg border border-accent bg-surface px-4 py-2.5 text-ink placeholder:text-ink-muted disabled:opacity-60"
          />

          <EmptyState
            title="La búsqueda en el catálogo externo todavía no está disponible"
            description="Se conectará cuando integremos IGDB, TMDB, BGG y Scryfall, según la categoría."
          />
        </>
      )}

      <p className="text-sm text-ink-muted">
        ¿No aparece lo que buscas?{" "}
        <Link
          href={`/anadir/${categoria}/manual`}
          className="text-accent underline transition-opacity duration-150 hover:opacity-80"
        >
          Alta manual
        </Link>
      </p>
    </section>
  );
}

function CatalogSearchBody({ state }: { state: CatalogSearchViewState }) {
  switch (state.kind) {
    case "idle":
      return (
        <EmptyState
          title="Busca un anime por su título"
          description="Escribe arriba y aparecerá lo que encuentre el catálogo externo. Si no está, siempre puedes darlo de alta a mano."
        />
      );
    case "results":
      return <CatalogSearchResults results={state.results} />;
    case "no_results":
      return (
        <EmptyState
          size="inline"
          title={`No hay resultados para “${state.query}”`}
          description="Prueba con otro título, o con el título original en inglés."
        />
      );
    case "error":
      return <ErrorState error={state.error} size="section" />;
  }
}
