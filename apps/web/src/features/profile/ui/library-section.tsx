import type { MockWork } from "@/features/library/lib/mock-works";
import { WorkCard } from "@/features/library/ui/work-card";

type LibrarySectionProps = {
  works: MockWork[];
};

/** The profile's public library: favourites only (docs/screens.md, ADR-0009). */
export function LibrarySection({ works }: LibrarySectionProps) {
  const favourites = works.filter((work) => work.isFavourite);

  if (favourites.length === 0) {
    return <p className="text-sm text-ink-muted">Sin favoritos todavía.</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {favourites.map((work) => (
        <WorkCard key={work.id} work={work} />
      ))}
    </div>
  );
}
