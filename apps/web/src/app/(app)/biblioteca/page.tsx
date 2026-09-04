import type { Metadata } from "next";
import { countByCategory, MOCK_WORKS } from "@/features/library/lib/mock-works";
import { CategoryTile } from "@/features/library/ui/category-tile";
import { CATEGORY_ORDER } from "@/shared/ui/category-stripe";

export const metadata: Metadata = { title: "Biblioteca" };

/** The lobby: the six categories as the entry point into the library (docs/screens.md). */
export default function LibraryLobbyPage() {
  const counts = countByCategory(MOCK_WORKS);

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Biblioteca</h1>
        <p className="text-ink-muted">
          Elige una categoría para ver lo que tienes registrado.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {CATEGORY_ORDER.map((category) => (
          <CategoryTile
            key={category}
            category={category}
            count={counts[category]}
            href={`/biblioteca/${category}`}
          />
        ))}
      </div>
    </section>
  );
}
