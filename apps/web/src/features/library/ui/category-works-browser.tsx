"use client";

import { useState } from "react";
import {
  filterWorks,
  type MockWork,
  sortWorks,
  type WorkFilters,
  type WorkSort,
} from "@/features/library/lib/mock-works";
import { WorkCard } from "@/features/library/ui/work-card";
import { cn } from "@/shared/lib/cn";
import { STATUS_ORDER } from "@/shared/ui/status-badge";

type CategoryWorksBrowserProps = {
  works: MockWork[];
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
 * the mock array already loaded on the page.
 */
export function CategoryWorksBrowser({ works }: CategoryWorksBrowserProps) {
  const [filters, setFilters] = useState<WorkFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<WorkSort>("recent");
  const filtered = sortWorks(filterWorks(works, filters), sort);

  const toggleStatus = (status: WorkFilters["status"]) => {
    setFilters((current) => ({
      ...current,
      status: current.status === status ? undefined : status,
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border-soft bg-surface p-3">
        {STATUS_ORDER.map(({ status, icon, label }) => (
          <button
            key={status}
            type="button"
            aria-pressed={filters.status === status}
            onClick={() => toggleStatus(status)}
            className={chipClass(filters.status === status)}
          >
            {icon} {label}
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
          ☆ Favoritos
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
          className="min-w-[170px] flex-1 rounded-full border border-border bg-ground-deep px-3.5 py-2 text-xs text-ink placeholder:text-ink-faint"
        />
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <span className="sr-only">Ordenar</span>
          <select
            aria-label="Ordenar"
            value={sort}
            onChange={(event) => setSort(event.target.value as WorkSort)}
            className="rounded-full border border-border bg-ground-deep px-3.5 py-2 text-xs text-ink-muted"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filtered.length > 0 ? (
        <div
          data-testid="category-works-grid"
          className="grid grid-cols-2 gap-[14px] md:grid-cols-3 md:gap-4 lg:grid-cols-6 lg:gap-[18px]"
        >
          {filtered.map((work) => (
            <WorkCard key={work.id} work={work} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-ink-muted">
          No hay obras con estos filtros.
        </p>
      )}
    </div>
  );
}
