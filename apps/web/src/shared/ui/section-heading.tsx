type SectionHeadingProps = {
  title: string;
  /** Shown next to the title. Zero is shown, not hidden: it is information. */
  count?: number;
  description?: string;
};

/** Heading for a section of a listing page, with an optional running count. */
export function SectionHeading({
  title,
  count,
  description,
}: SectionHeadingProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-lg font-semibold text-ink">{title}</h2>
        {count !== undefined ? (
          <span
            data-testid="section-heading-count"
            className="font-mono text-sm text-ink-muted"
          >
            {count}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="text-sm text-ink-muted">{description}</p>
      ) : null}
    </div>
  );
}
