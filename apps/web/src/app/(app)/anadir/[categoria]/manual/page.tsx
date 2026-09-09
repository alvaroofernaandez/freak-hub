import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "reicon-react";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategoryId,
} from "@/shared/ui/category-stripe";

type ManualAddPageProps = {
  params: Promise<{ categoria: string }>;
};

function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_ORDER as string[]).includes(value);
}

export async function generateMetadata({
  params,
}: ManualAddPageProps): Promise<Metadata> {
  const { categoria } = await params;
  return { title: isCategoryId(categoria) ? "Alta manual" : "" };
}

/**
 * Step three of adding a work: manual entry for what the catalog search
 * does not find (docs/catalogs.md). No submit action yet — that requires
 * the real POST /v1/library endpoint (docs/roadmap.md).
 */
export default async function ManualAddPage({ params }: ManualAddPageProps) {
  const { categoria } = await params;

  if (!isCategoryId(categoria)) {
    notFound();
    return;
  }

  return (
    <section className="space-y-6">
      <Link
        href={`/anadir/${categoria}`}
        className="text-sm font-semibold text-ink-muted transition-colors duration-150 hover:text-ink"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Volver
      </Link>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">
          Añadir · {CATEGORY_LABELS[categoria]} · Alta manual
        </h1>
        <p className="text-ink-muted">Para lo que no aparece en el catálogo.</p>
      </div>

      <form
        data-testid="manual-add-form"
        className="flex max-w-[520px] flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="title"
            className="font-mono text-xs uppercase tracking-widest text-ink-muted"
          >
            Título
          </label>
          <input
            id="title"
            name="title"
            type="text"
            className="rounded-lg border border-border bg-surface px-4 py-2.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="year"
            className="font-mono text-xs uppercase tracking-widest text-ink-muted"
          >
            Año
          </label>
          <input
            id="year"
            name="year"
            type="number"
            className="rounded-lg border border-border bg-surface px-4 py-2.5"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="synopsis"
            className="font-mono text-xs uppercase tracking-widest text-ink-muted"
          >
            Sinopsis
          </label>
          <textarea
            id="synopsis"
            name="synopsis"
            rows={4}
            className="rounded-lg border border-border bg-surface px-4 py-2.5"
          />
        </div>
        <button
          type="button"
          disabled
          className="self-start rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-ink disabled:opacity-50"
        >
          Guardar
        </button>
      </form>
    </section>
  );
}
