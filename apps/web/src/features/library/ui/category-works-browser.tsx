"use client";

import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Star } from "reicon-react";
import {
  filterWorks,
  sortWorks,
  type Work,
  type WorkFilters,
  type WorkSort,
} from "@/features/library/lib/work";
import { WorkCard } from "@/features/library/ui/work-card";
import { cn } from "@/shared/lib/cn";
import {
  DURATION,
  EXIT_RATIO,
  LAYOUT_SPRING,
  staggerStyle,
} from "@/shared/motion/tokens";
import type { CategoryId } from "@/shared/ui/category-stripe";
import { EmptyState } from "@/shared/ui/empty-state";
import { Select } from "@/shared/ui/select";
import { STATUS_ORDER } from "@/shared/ui/status-badge";

const EXIT_TRANSITION = { duration: DURATION.base * EXIT_RATIO };

type CategoryWorksBrowserProps = {
  works: Work[];
  category: CategoryId;
};

const EMPTY_FILTERS: WorkFilters = {};

const SORT_OPTIONS: { value: WorkSort; label: string }[] = [
  { value: "recent", label: "Recientes" },
  { value: "alphabetical", label: "Alfabético" },
  { value: "rating", label: "Valoración" },
];

const chipClass = (pressed: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 font-sans text-[11px] font-semibold transition-colors",
    pressed
      ? "border-accent bg-accent text-accent-ink"
      : "border-border text-ink-muted hover:text-ink",
  );

/**
 * Client-side status/favourite/owned/search filtering, plus sorting, over a
 * category's works (docs/screens.md#biblioteca-por-categoría,
 * docs/design/high-fidelity-desktop.html §3). No API call: filters and sorts
 * the works array already loaded on the page.
 *
 * When the category has no works at all yet (there is no library endpoint,
 * see docs/roadmap.md), the filter bar has nothing to filter, so it is
 * replaced by an honest empty state with a real action: go add one.
 */
export function CategoryWorksBrowser({
  works,
  category,
}: CategoryWorksBrowserProps) {
  const [filters, setFilters] = useState<WorkFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<WorkSort>("recent");
  const filtered = sortWorks(filterWorks(works, filters), sort);
  const hasSearch = Boolean(filters.search?.trim());
  const hasActiveFilters = Boolean(
    filters.status || filters.favouriteOnly || filters.ownedOnly,
  );

  // Announced on a short delay after the result count settles, not on every
  // keystroke of a search — a burst of live-region updates while typing is
  // noise, not help (docs/states.md).
  const [announcedCount, setAnnouncedCount] = useState<number | null>(null);
  useEffect(() => {
    if (works.length === 0 || (!hasSearch && !hasActiveFilters)) {
      return;
    }
    const timer = window.setTimeout(() => {
      setAnnouncedCount(filtered.length);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [filtered.length, works.length, hasSearch, hasActiveFilters]);

  const toggleStatus = (status: WorkFilters["status"]) => {
    setFilters((current) => ({
      ...current,
      status: current.status === status ? undefined : status,
    }));
  };

  function clearSearch() {
    setFilters((current) => ({ ...current, search: "" }));
  }

  function clearFilters() {
    setFilters((current) => ({
      ...current,
      status: undefined,
      favouriteOnly: undefined,
      ownedOnly: undefined,
    }));
  }

  if (works.length === 0) {
    return (
      <EmptyState
        title="Aún no has añadido ninguna obra a esta categoría"
        description="Cuando añadas algo, aparecerá aquí."
        action={
          <Link
            href={`/anadir/${category}`}
            className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
          >
            Añadir una obra
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {announcedCount !== null ? (
        <output aria-live="polite" className="sr-only">
          {announcedCount === 1
            ? "1 resultado."
            : `${announcedCount} resultados.`}
        </output>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border-soft bg-surface p-3">
        {STATUS_ORDER.map(({ status, Icon, label }) => (
          <button
            key={status}
            type="button"
            aria-pressed={filters.status === status}
            onClick={() => toggleStatus(status)}
            className={chipClass(filters.status === status)}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
        <div className="mx-1.5 h-5 w-px bg-border" aria-hidden="true" />
        <button
          type="button"
          aria-pressed={filters.favouriteOnly ?? false}
          onClick={() =>
            setFilters((current) => ({
              ...current,
              favouriteOnly: !current.favouriteOnly,
            }))
          }
          className={chipClass(filters.favouriteOnly ?? false)}
        >
          <Star size={14} aria-hidden="true" />
          Favoritos
        </button>
        <button
          type="button"
          aria-pressed={filters.ownedOnly ?? false}
          onClick={() =>
            setFilters((current) => ({
              ...current,
              ownedOnly: !current.ownedOnly,
            }))
          }
          className={chipClass(filters.ownedOnly ?? false)}
        >
          En propiedad
        </button>
        <input
          type="search"
          aria-label="Buscar"
          placeholder="Buscar…"
          value={filters.search ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              search: event.target.value,
            }))
          }
          className="min-w-[170px] flex-1 rounded-full border border-border bg-ground-deep px-3.5 py-2 text-xs text-ink placeholder:text-ink-muted"
        />
        <Select
          label="Ordenar"
          value={sort}
          onValueChange={(value) => setSort(value as WorkSort)}
          options={[...SORT_OPTIONS]}
        />
      </div>

      {filtered.length > 0 ? (
        <div
          data-testid="category-works-grid"
          className="grid grid-cols-2 gap-[14px] md:grid-cols-3 md:gap-4 lg:grid-cols-6 lg:gap-[18px]"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((work, index) => (
              <m.div
                key={work.id}
                layout
                transition={LAYOUT_SPRING}
                exit={{ opacity: 0, scale: 0.95, transition: EXIT_TRANSITION }}
                className="stagger-in"
                style={staggerStyle(index) as CSSProperties}
              >
                <WorkCard work={work} />
              </m.div>
            ))}
          </AnimatePresence>
        </div>
      ) : hasSearch ? (
        <EmptyState
          size="inline"
          title={`No hay resultados para “${filters.search}”`}
          description="Prueba con otro término, o quita la búsqueda para ver el resto."
          action={
            <button
              type="button"
              onClick={clearSearch}
              className="rounded-lg border border-border px-3.5 py-2 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              Limpiar búsqueda
            </button>
          }
        />
      ) : (
        <EmptyState
          size="inline"
          title="No hay obras con estos filtros"
          description="Quita alguno de los filtros activos para ver más resultados."
          action={
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-border px-3.5 py-2 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              Quitar filtros
            </button>
          }
        />
      )}
    </div>
  );
}
