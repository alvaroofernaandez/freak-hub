"use client";

import { AnimatePresence, LayoutGroup, m } from "motion/react";
import type { KeyboardEvent, ReactNode } from "react";
import { useId, useState } from "react";
import { cn } from "@/shared/lib/cn";
import {
  DURATION,
  EASE_OUT_QUINT,
  LAYOUT_SPRING,
} from "@/shared/motion/tokens";

// Direction-aware content transition, adapted from Cult UI's
// `direction-aware-tabs.tsx`
// (github.com/nolly-studio/cult-ui, apps/www/registry/default/ui/direction-aware-tabs.tsx).
// Changed from the original:
//   - x offsets shrunk from 300px to the project's ±24px enter / ±12px exit
//     (docs/design.md #movimiento), and duration/easing come from
//     `shared/motion/tokens.ts` instead of a bespoke spring;
//   - dropped `filter: blur(4px)` (matches the ADR-0013 decision to drop
//     blur from list-style entrances elsewhere in the app);
//   - dropped the original's `bounce: 0.19/0.2` spring in favour of the
//     project's no-bounce quint tween — nothing in this system bounces;
//   - dropped the `isAnimating` flag that blocked clicks while the previous
//     transition was still running: a tab switch is interruptible here,
//     never disables the tab strip;
//   - dropped the original's `animate={{ height: bounds.height }}`
//     (a layout property) and the `react-use-measure` dependency it needed
//     — this never animates height, so there is nothing to measure;
//   - keeps full `tablist`/`tab`/`tabpanel` ARIA semantics, which the
//     original (a generic pill switcher, not built for tab semantics) never
//     had: each tab is wired to its tabpanel with matching, per-instance
//     `aria-controls`/`id`/`aria-labelledby`, and the tablist follows the
//     WAI-ARIA APG tabs pattern's roving tabindex (only the selected tab is
//     in the tab order; Arrow Left/Right, Home and End move focus and
//     selection together, wrapping at the ends).
const tabContentVariants = {
  initial: (direction: number) => ({ x: direction * 24, opacity: 0 }),
  active: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -12, opacity: 0 }),
};

const TAB_CONTENT_TRANSITION = {
  duration: DURATION.base,
  ease: EASE_OUT_QUINT,
};

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
  // -1 (entered from the left), 0 (no change yet, first render) or 1
  // (entered from the right), based on the picked tab's position relative
  // to the one that was active before it.
  const [direction, setDirection] = useState(0);

  function selectSection(id: SectionId) {
    const fromIndex = current ? orderedVisible.indexOf(current) : -1;
    const toIndex = orderedVisible.indexOf(id);
    setDirection(toIndex > fromIndex ? 1 : toIndex < fromIndex ? -1 : 0);
    setActive(id);
  }

  // Scopes the indicator's layoutId to this instance. Without it, two
  // `SectionTabs` rendered on the same page (own profile + a friend's, say)
  // would share the literal layoutId "section-tab-indicator", and Motion's
  // layout system treats a shared layoutId as one element across every
  // instance that renders it — the two indicators would try to morph into
  // each other instead of sliding independently.
  const layoutGroupId = useId();
  // Scopes tab/tabpanel ids to this instance for the same reason.
  const instanceId = useId();
  const panelId = `${instanceId}-panel`;
  const tabId = (id: SectionId) => `${instanceId}-tab-${id}`;

  /** WAI-ARIA APG tabs pattern: Arrow Left/Right, Home and End move focus and
   * selection together (automatic activation), wrapping at the ends. */
  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = current ? orderedVisible.indexOf(current) : -1;
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % orderedVisible.length;
        break;
      case "ArrowLeft":
        nextIndex =
          (currentIndex - 1 + orderedVisible.length) % orderedVisible.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = orderedVisible.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const nextId = orderedVisible[nextIndex];
    if (nextId === undefined) {
      return;
    }
    selectSection(nextId);
    // The tab element re-renders (tabindex/aria-selected flip) before this
    // focus call runs, since selectSection's setState is already flushed by
    // the time the browser processes the next task.
    document.getElementById(tabId(nextId))?.focus();
  }

  return (
    <LayoutGroup id={layoutGroupId}>
      <div data-testid="section-tabs" data-layout-group={layoutGroupId}>
        <div role="tablist" className="flex gap-1 border-b border-border">
          {orderedVisible.map((id) => (
            <button
              key={id}
              id={tabId(id)}
              type="button"
              role="tab"
              aria-selected={id === current}
              aria-controls={panelId}
              tabIndex={id === current ? 0 : -1}
              onClick={() => selectSection(id)}
              onKeyDown={handleTabKeyDown}
              className={cn(
                "relative px-4 py-2.5 text-sm font-medium transition-colors duration-150",
                id === current ? "text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              {SECTION_LABELS[id]}
              {id === current ? (
                <m.span
                  data-testid="section-tab-indicator"
                  layoutId="section-tab-indicator"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-accent"
                  transition={LAYOUT_SPRING}
                />
              ) : null}
            </button>
          ))}
        </div>
        <div
          id={panelId}
          role="tabpanel"
          aria-labelledby={current ? tabId(current) : undefined}
          className="pt-6"
        >
          <AnimatePresence mode="popLayout" custom={direction} initial={false}>
            <m.div
              key={current}
              data-testid="section-tab-content"
              data-direction={direction}
              custom={direction}
              variants={tabContentVariants}
              initial="initial"
              animate="active"
              exit="exit"
              transition={TAB_CONTENT_TRANSITION}
            >
              {current ? sections[current] : null}
            </m.div>
          </AnimatePresence>
        </div>
      </div>
    </LayoutGroup>
  );
}
