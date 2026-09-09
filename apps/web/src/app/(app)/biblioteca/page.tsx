import type { Metadata } from "next";
import { countByCategory } from "@/features/library/lib/work";
import { CategoryTile } from "@/features/library/ui/category-tile";
import { CATEGORY_ORDER } from "@/shared/ui/category-stripe";

export const metadata: Metadata = { title: "Biblioteca" };

/**
 * The lobby: the six categories as the entry point into the library
 * (docs/screens.md). The category grid itself is part of the domain, not
 * mock data, so it always renders; only the per-category counts are zero
 * until the library endpoint exists (docs/roadmap.md).
 */
export default function LibraryLobbyPage() {
  const counts = countByCategory([]);

  return (
    <section className="space-y-[22px] md:space-y-[18px] lg:space-y-[30px]">
      <h1 className="text-[24px] font-bold text-ink md:text-[25px] lg:text-[28px]">
        Tu biblioteca
      </h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:gap-5">
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
