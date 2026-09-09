import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { worksByCategory } from "@/features/library/lib/work";
import { CategoryWorksBrowser } from "@/features/library/ui/category-works-browser";
import { SetActiveCategory } from "@/shared/ui/active-category";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategoryId,
} from "@/shared/ui/category-stripe";

type CategoryLibraryPageProps = {
  params: Promise<{ categoria: string }>;
};

function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_ORDER as string[]).includes(value);
}

export async function generateMetadata({
  params,
}: CategoryLibraryPageProps): Promise<Metadata> {
  const { categoria } = await params;
  return { title: isCategoryId(categoria) ? CATEGORY_LABELS[categoria] : "" };
}

/**
 * A category's own library listing, filterable client-side (docs/screens.md).
 * There is no library endpoint yet (docs/roadmap.md), so every category is
 * empty for now; `CategoryWorksBrowser` renders the honest empty state.
 */
export default async function CategoryLibraryPage({
  params,
}: CategoryLibraryPageProps) {
  const { categoria } = await params;

  if (!isCategoryId(categoria)) {
    notFound();
  }

  const works = worksByCategory([], categoria);

  return (
    <section className="space-y-6">
      <SetActiveCategory category={categoria} />
      <h1 className="text-3xl font-semibold">{CATEGORY_LABELS[categoria]}</h1>
      <CategoryWorksBrowser works={works} category={categoria} />
    </section>
  );
}
