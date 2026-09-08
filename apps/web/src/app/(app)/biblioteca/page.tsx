import type { Metadata } from "next";
import { countByCategory, MOCK_WORKS } from "@/features/library/lib/mock-works";
import { CategoryTile } from "@/features/library/ui/category-tile";
import { CATEGORY_ORDER } from "@/shared/ui/category-stripe";

export const metadata: Metadata = { title: "Biblioteca" };

/** The lobby: the six categories as the entry point into the library (docs/screens.md). */
export default function LibraryLobbyPage() {
  const counts = countByCategory(MOCK_WORKS);

  return (
    <section className="space-y-[22px] md:space-y-[18px] lg:space-y-[30px]">
      <h1 className="text-[24px] font-bold text-ink md:text-[25px] lg:text-[28px]">
        Tu biblioteca
      </h1>
      <div className="grid grid-cols-2 gap-[14px] md:grid-cols-3 md:gap-[18px] lg:gap-[22px]">
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
