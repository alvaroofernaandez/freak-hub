import type { Work } from "@/features/library/lib/work";
import { WorkCard } from "@/features/library/ui/work-card";
import { EmptyState } from "@/shared/ui/empty-state";

type LibrarySectionProps = {
  works: Work[];
};

/** The profile's public library: favourites only (docs/screens.md, ADR-0009). */
export function LibrarySection({ works }: LibrarySectionProps) {
  const favourites = works.filter((work) => work.isFavourite);

  if (favourites.length === 0) {
    return (
      <EmptyState
        title="Sin favoritos todavía"
        description="Aquí aparecerán las obras que marques como favoritas."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {favourites.map((work) => (
        <WorkCard key={work.id} work={work} />
      ))}
    </div>
  );
}
