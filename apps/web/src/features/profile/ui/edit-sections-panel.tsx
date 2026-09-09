"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  restrictToParentElement,
  restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Reorder } from "reicon-react";
import { cn } from "@/shared/lib/cn";
import { Checkbox } from "@/shared/ui/checkbox";
import { Select } from "@/shared/ui/select";
import { SECTION_LABELS, SECTION_ORDER, type SectionId } from "./section-tabs";

export type ProfilePreferences = {
  /**
   * All four sections in the member's chosen order, which is also the order of
   * the tabs. Optional so preferences stored before ordering existed still
   * load; they fall back to the canonical order.
   */
  order?: SectionId[];
  visibleSections: SectionId[];
  defaultSection: SectionId;
};

type EditSectionsPanelProps = ProfilePreferences & {
  onChange: (next: ProfilePreferences) => void;
};

/**
 * Moves `moved` to where `target` sits, keeping everything else in order.
 * Pulled out of the drag handler so the reordering itself is testable without
 * a layout engine.
 */
export function moveSection(
  order: SectionId[],
  moved: SectionId,
  target: SectionId,
): SectionId[] {
  const from = order.indexOf(moved);
  const to = order.indexOf(target);

  if (from === -1 || to === -1 || from === to) {
    return order;
  }

  return arrayMove(order, from, to);
}

/** Whatever order was stored, completed with any section missing from it. */
function resolveOrder(order: SectionId[] | undefined): SectionId[] {
  const chosen = (order ?? []).filter((id) => SECTION_ORDER.includes(id));
  return [...chosen, ...SECTION_ORDER.filter((id) => !chosen.includes(id))];
}

type SectionRowProps = {
  id: SectionId;
  visible: boolean;
  canHide: boolean;
  onVisibilityChange: (visible: boolean) => void;
};

function SectionRow({
  id,
  visible,
  canHide,
  onVisibilityChange,
}: SectionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <li
      ref={setNodeRef}
      data-testid="section-row"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-surface p-2.5",
        isDragging
          ? "relative z-10 border-accent shadow-lg"
          : "border-border-soft",
      )}
    >
      <button
        type="button"
        aria-label={`Mover ${SECTION_LABELS[id]}`}
        className="flex h-8 w-6 shrink-0 items-center justify-center rounded text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:text-ink"
        {...attributes}
        {...listeners}
      >
        <Reorder size={16} aria-hidden="true" />
      </button>

      <span data-testid="section-name" className="flex-1 text-sm text-ink">
        {SECTION_LABELS[id]}
      </span>

      <Checkbox
        checked={visible}
        disabled={visible && !canHide}
        onCheckedChange={onVisibilityChange}
        label={SECTION_LABELS[id]}
        hideLabel
      />
    </li>
  );
}

/**
 * Which sections show on your own profile, in which order, and which one opens
 * first (ADR-0010). A preference only you can set: it never changes what a
 * visitor sees.
 *
 * Rows are reorderable by pointer and by keyboard alike, so the arrangement is
 * not locked behind a drag gesture.
 */
export function EditSectionsPanel({
  order,
  visibleSections,
  defaultSection,
  onChange,
}: EditSectionsPanelProps) {
  const resolvedOrder = resolveOrder(order);
  const visibleInOrder = resolvedOrder.filter((id) =>
    visibleSections.includes(id),
  );
  const canHide = visibleInOrder.length > 1;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function emit(nextOrder: SectionId[], nextVisible: SectionId[]) {
    const visible = nextOrder.filter((id) => nextVisible.includes(id));
    onChange({
      order: nextOrder,
      visibleSections: visible,
      defaultSection: visible.includes(defaultSection)
        ? defaultSection
        : (visible[0] ?? defaultSection),
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    emit(
      moveSection(resolvedOrder, active.id as SectionId, over.id as SectionId),
      visibleSections,
    );
  }

  function toggleSection(id: SectionId, checked: boolean) {
    if (!checked && !canHide) {
      return;
    }

    emit(
      resolvedOrder,
      checked
        ? [...visibleSections, id]
        : visibleSections.filter((candidate) => candidate !== id),
    );
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-surface-raised p-5">
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          Orden y visibilidad
        </p>
        <p className="text-sm text-ink-muted">
          Arrastra para cambiar el orden de las pestañas. Desmarca una sección
          para ocultarla de tu perfil.
        </p>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={resolvedOrder}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {resolvedOrder.map((id) => (
                <SectionRow
                  key={id}
                  id={id}
                  visible={visibleSections.includes(id)}
                  canHide={canHide}
                  onVisibilityChange={(visible) => toggleSection(id, visible)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-soft pt-4">
        <span className="text-sm text-ink-muted">
          Sección que se abre por defecto
        </span>
        <Select
          label="Sección que se abre por defecto"
          value={defaultSection}
          onValueChange={(value) =>
            onChange({
              order: resolvedOrder,
              visibleSections: visibleInOrder,
              defaultSection: value as SectionId,
            })
          }
          options={visibleInOrder.map((id) => ({
            value: id,
            label: SECTION_LABELS[id],
          }))}
        />
      </div>
    </div>
  );
}
