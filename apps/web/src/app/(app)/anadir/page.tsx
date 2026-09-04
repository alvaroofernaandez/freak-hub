import type { Metadata } from "next";
import { countByCategory, MOCK_WORKS } from "@/features/library/lib/mock-works";
import { CategoryTile } from "@/features/library/ui/category-tile";
import { CATEGORY_ORDER } from "@/shared/ui/category-stripe";

export const metadata: Metadata = { title: "Añadir" };

/** Step one of adding a work: pick a category (docs/screens.md#añadir-categoría). */
export default function AddCategoryPickerPage() {
  const counts = countByCategory(MOCK_WORKS);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Añadir</h1>
        <p className="text-ink-muted">¿Qué categoría quieres registrar?</p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {CATEGORY_ORDER.map((category) => (
          <CategoryTile
            key={category}
            category={category}
            count={counts[category]}
            href={`/anadir/${category}`}
          />
        ))}
      </div>
    </section>
  );
}
