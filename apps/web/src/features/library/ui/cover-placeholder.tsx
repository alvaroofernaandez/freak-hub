import { cn } from "@/shared/lib/cn";

type CoverPlaceholderProps = {
  /** Size (and any other override) classes — callers own the dimensions. */
  className?: string;
  testId?: string;
};

/**
 * The repeating-stripe placeholder used everywhere a cover image is missing
 * (docs/design/high-fidelity-desktop.html): the work page header (§4, 220×300/
 * 230×170/300×220 depending on breakpoint) and the add-search results list
 * (§6, 58×78). Size is entirely up to the caller via `className`, since it
 * differs by call site.
 */
export function CoverPlaceholder({ className, testId }: CoverPlaceholderProps) {
  return (
    <div
      data-testid={testId}
      style={{
        backgroundImage:
          "repeating-linear-gradient(45deg, var(--color-ground-deep), var(--color-ground-deep) 6px, var(--color-surface-raised) 6px, var(--color-surface-raised) 12px)",
      }}
      className={cn(
        "flex flex-none items-center justify-center rounded-xl font-mono text-[11px] text-ink-faint",
        className,
      )}
    >
      portada
    </div>
  );
}
