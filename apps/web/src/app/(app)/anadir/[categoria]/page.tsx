import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { mockSearchResults } from "@/features/library/lib/mock-search-results";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategoryId,
} from "@/shared/ui/category-stripe";

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
 * (docs/catalogs.md). Not implemented yet, so the field is disabled and the
 * results are mock data (docs/roadmap.md) — a preview of the future layout.
 */
export default async function AddSearchPage({ params }: AddSearchPageProps) {
  const { categoria } = await params;

  if (!isCategoryId(categoria)) {
    notFound();
    return;
  }

  const results = mockSearchResults(categoria);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">
          Añadir · {CATEGORY_LABELS[categoria]}
        </h1>
        <p className="text-ink-muted">
          Busca en el catálogo externo de esta categoría.
        </p>
      </div>

      <div className="space-y-2">
        <input
          type="search"
          disabled
          placeholder="Buscar…"
          className="w-full max-w-md rounded-lg border border-border bg-surface px-4 py-2.5 text-ink placeholder:text-ink-muted disabled:opacity-60"
        />
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          Búsqueda en construcción — estos son resultados de ejemplo
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {results.map((result) => (
          <li
            key={result.id}
            className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-4 py-3"
          >
            <span>
              {result.title}{" "}
              <span className="text-ink-muted">({result.year})</span>
            </span>
            <button
              type="button"
              disabled
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink-muted disabled:opacity-60"
            >
              Añadir
            </button>
          </li>
        ))}
      </ul>

      <p className="text-sm text-ink-muted">
        ¿No aparece lo que buscas?{" "}
        <Link
          href={`/anadir/${categoria}/manual`}
          className="text-accent underline"
        >
          Alta manual
        </Link>
      </p>
    </section>
  );
}
