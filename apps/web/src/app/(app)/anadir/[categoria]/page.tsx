import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "reicon-react";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategoryId,
} from "@/shared/ui/category-stripe";
import { EmptyState } from "@/shared/ui/empty-state";

type AddSearchPageProps = {
  params: Promise<{ categoria: string }>;
};

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
 * (docs/catalogs.md). That integration (AniList, IGDB, TMDB, BGG, Scryfall)
 * does not exist yet (docs/roadmap.md), so the field stays disabled and the
 * results area says so honestly instead of showing invented results: this
 * is a "not built yet" state, not an "add your first thing" state, so it
 * carries no action.
 */
export default async function AddSearchPage({ params }: AddSearchPageProps) {
  const { categoria } = await params;

  if (!isCategoryId(categoria)) {
    notFound();
    return;
  }

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

      <input
        type="search"
        disabled
        placeholder="Buscar…"
        className="w-full max-w-md rounded-lg border border-accent bg-surface px-4 py-2.5 text-ink placeholder:text-ink-muted disabled:opacity-60"
      />

      <EmptyState
        title="La búsqueda en el catálogo externo todavía no está disponible"
        description="Se conectará cuando integremos AniList, IGDB, TMDB, BGG y Scryfall, según la categoría."
      />

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
