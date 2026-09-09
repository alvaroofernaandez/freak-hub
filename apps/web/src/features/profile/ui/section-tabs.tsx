"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { cn } from "@/shared/lib/cn";

export type SectionId = "library" | "activity" | "top" | "recommendations";

/** The four profile sections, in their canonical order (ADR-0010). */
export const SECTION_ORDER: SectionId[] = [
  "library",
  "activity",
  "top",
  "recommendations",
];

export const SECTION_LABELS: Record<SectionId, string> = {
  library: "Biblioteca",
  activity: "Actividad",
  top: "Top",
  recommendations: "Recomendaciones",
};

type SectionTabsProps = {
  visibleSections: SectionId[];
  /** The member's chosen order. Falls back to the canonical one. */
  order?: SectionId[];
  defaultSection: SectionId;
  sections: Record<SectionId, ReactNode>;
};

/** The alternable sections of a profile (docs/screens.md, ADR-0010). */
export function SectionTabs({
  visibleSections,
  order,
  defaultSection,
  sections,
}: SectionTabsProps) {
  const resolvedOrder = [
    ...(order ?? []).filter((id) => SECTION_ORDER.includes(id)),
    ...SECTION_ORDER.filter((id) => !(order ?? []).includes(id)),
  ];
  const orderedVisible = resolvedOrder.filter((id) =>
    visibleSections.includes(id),
  );
  const initial = orderedVisible.includes(defaultSection)
    ? defaultSection
    : orderedVisible[0];
  const [active, setActive] = useState<SectionId | undefined>(initial);
  const current = active && orderedVisible.includes(active) ? active : initial;

  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-border">
        {orderedVisible.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === current}
            onClick={() => setActive(id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors duration-150",
              id === current
                ? "border-b-2 border-accent text-ink"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {SECTION_LABELS[id]}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-6">
        {current ? sections[current] : null}
      </div>
    </div>
  );
}
