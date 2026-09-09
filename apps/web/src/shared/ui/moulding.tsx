import { cn } from "@/shared/lib/cn";

/** The six roster colours, in category order (docs/design.md#motivo-recurrente). */
const SEGMENTS = [
  "bg-cat-anime",
  "bg-cat-manga",
  "bg-cat-games",
  "bg-cat-films",
  "bg-cat-board",
  "bg-cat-tcg",
];

/**
 * The "moldura": the six-colour band borrowed from the arcade cabinet in the
 * README banner. It separates important sections and doubles as a visual index
 * of the six categories (docs/design.md).
 */
export function Moulding({ className }: { className?: string }) {
  return (
    <div
      data-testid="moulding"
      aria-hidden="true"
      className={cn("flex h-1 gap-0.5", className)}
    >
      {SEGMENTS.map((segment) => (
        <span
          key={segment}
          data-testid="moulding-segment"
          className={cn("flex-1 rounded-full", segment)}
        />
      ))}
    </div>
  );
}
