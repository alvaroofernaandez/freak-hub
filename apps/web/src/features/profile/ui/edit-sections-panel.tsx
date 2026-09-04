import { SECTION_LABELS, SECTION_ORDER, type SectionId } from "./section-tabs";

export type ProfilePreferences = {
  visibleSections: SectionId[];
  defaultSection: SectionId;
};

type EditSectionsPanelProps = ProfilePreferences & {
  onChange: (next: ProfilePreferences) => void;
};

/**
 * Which sections show on your own profile, and which opens by default
 * (ADR-0010) — a preference only you can set, never affecting a visitor's
 * view.
 */
export function EditSectionsPanel({
  visibleSections,
  defaultSection,
  onChange,
}: EditSectionsPanelProps) {
  const orderedVisible = SECTION_ORDER.filter((id) =>
    visibleSections.includes(id),
  );

  function toggleSection(id: SectionId, checked: boolean) {
    if (!checked && orderedVisible.length <= 1) {
      return;
    }

    const nextVisible = checked
      ? SECTION_ORDER.filter(
          (candidate) => orderedVisible.includes(candidate) || candidate === id,
        )
      : orderedVisible.filter((candidate) => candidate !== id);

    const nextDefault = nextVisible.includes(defaultSection)
      ? defaultSection
      : nextVisible[0];

    onChange({ visibleSections: nextVisible, defaultSection: nextDefault });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-raised p-5">
      <fieldset className="space-y-2">
        <legend className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          Secciones visibles
        </legend>
        {SECTION_ORDER.map((id) => (
          <label key={id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={orderedVisible.includes(id)}
              disabled={
                orderedVisible.includes(id) && orderedVisible.length <= 1
              }
              onChange={(event) => toggleSection(id, event.target.checked)}
            />
            {SECTION_LABELS[id]}
          </label>
        ))}
      </fieldset>

      <label className="flex items-center gap-2 text-sm text-ink-muted">
        Sección que se abre por defecto
        <select
          value={defaultSection}
          onChange={(event) =>
            onChange({
              visibleSections: orderedVisible,
              defaultSection: event.target.value as SectionId,
            })
          }
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-ink"
        >
          {orderedVisible.map((id) => (
            <option key={id} value={id}>
              {SECTION_LABELS[id]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
