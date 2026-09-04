"use client";

import { useState } from "react";
import {
  filterWorks,
  type MockWork,
  type WorkFilters,
} from "@/features/library/lib/mock-works";
import { WorkCard } from "@/features/library/ui/work-card";
import { STATUS_ORDER } from "@/shared/ui/status-badge";

type CategoryWorksBrowserProps = {
  works: MockWork[];
};

const EMPTY_FILTERS: WorkFilters = {};

/**
 * Client-side status/favourite/owned filtering over a category's works
 * (docs/screens.md#biblioteca-por-categoría). No API call: filters the mock
 * array already loaded on the page.
 */
export function CategoryWorksBrowser({ works }: CategoryWorksBrowserProps) {
  const [filters, setFilters] = useState<WorkFilters>(EMPTY_FILTERS);
  const filtered = filterWorks(works, filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          Estado
          <select
            value={filters.status ?? ""}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value
                  ? (event.target.value as WorkFilters["status"])
                  : undefined,
              }))
            }
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-ink"
          >
            <option value="">Todos</option>
            {STATUS_ORDER.map(({ status, label }) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={filters.favouriteOnly ?? false}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                favouriteOnly: event.target.checked,
              }))
            }
          />
          Solo favoritos
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={filters.ownedOnly ?? false}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                ownedOnly: event.target.checked,
              }))
            }
          />
          Solo que tengo
        </label>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
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
