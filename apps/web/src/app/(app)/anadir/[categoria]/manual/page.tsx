import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "reicon-react";
import { ManualAddForm } from "@/features/library/ui/manual-add-form";
import type { WorkCategory } from "@/shared/api/types";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/shared/ui/category-stripe";

type ManualAddPageProps = {
  params: Promise<{ categoria: string }>;
};

function isWorkCategory(value: string): value is WorkCategory {
  return (CATEGORY_ORDER as string[]).includes(value);
}

export async function generateMetadata({
  params,
}: ManualAddPageProps): Promise<Metadata> {
  const { categoria } = await params;
  return { title: isWorkCategory(categoria) ? "Alta manual" : "" };
}

/**
 * Step three of adding a work: manual entry for what the catalogue search
 * does not find (docs/catalogs.md).
 *
 * The page stays a server component and owns only what the route decides:
 * the category is validated here, so a URL nobody typed on purpose is a 404
 * rather than a form that submits a category the contract will refuse. The
 * fields, the status picker and the two writes live in `ManualAddForm`.
 */
export default async function ManualAddPage({ params }: ManualAddPageProps) {
  const { categoria } = await params;

  if (!isWorkCategory(categoria)) {
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

      <ManualAddForm category={categoria} />
    </section>
  );
}
