"use client";

import type { Work } from "@/features/library/lib/work";
import { WorkCard } from "@/features/library/ui/work-card";
import { useAddCategoryModal } from "@/shared/ui/add-category-modal";
import { EmptyState } from "@/shared/ui/empty-state";

type LibrarySectionProps = {
  works: Work[];
  /** Only the profile owner can add a work from their own empty library —
   * never shown on a friend's read-only profile (docs/states.md). */
  canAdd?: boolean;
};

/** The profile's public library: favourites only (docs/screens.md, ADR-0009). */
export function LibrarySection({ works, canAdd = false }: LibrarySectionProps) {
  const { open } = useAddCategoryModal();
  const favourites = works.filter((work) => work.isFavourite);

  if (favourites.length === 0) {
    return (
      <EmptyState
        title="Sin favoritos todavía"
        description="Aquí aparecerán las obras que marques como favoritas."
        action={
          canAdd ? (
            <button
              type="button"
              onClick={open}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
            >
              Añadir una obra
            </button>
          ) : undefined
        }
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
