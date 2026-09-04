import { cn } from "@/shared/lib/cn";

/**
 * No contract type exists for category yet (Work is not implemented), so
 * this union lives local to the component until then.
 */
export type CategoryId =
  | "anime"
  | "manga"
  | "game"
  | "film"
  | "boardgame"
  | "tcg";

const SEGMENTS: { id: CategoryId; colorClass: string }[] = [
  { id: "anime", colorClass: "bg-cat-anime" },
  { id: "manga", colorClass: "bg-cat-manga" },
  { id: "game", colorClass: "bg-cat-games" },
  { id: "film", colorClass: "bg-cat-films" },
  { id: "boardgame", colorClass: "bg-cat-board" },
  { id: "tcg", colorClass: "bg-cat-tcg" },
];

type CategoryStripeProps = {
  activeCategory?: CategoryId;
};

/** The "moldura": the six-color category stripe below the navbar (docs/design.md). */
export function CategoryStripe({ activeCategory }: CategoryStripeProps) {
  return (
    <div
      data-testid="category-stripe"
      aria-hidden="true"
      className="flex h-2 w-full"
    >
      {SEGMENTS.map((segment) => (
        <div
          key={segment.id}
          data-testid="category-stripe-segment"
          data-category={segment.id}
          className={cn(
            segment.colorClass,
            segment.id === activeCategory ? "flex-[2]" : "flex-1",
          )}
        />
      ))}
    </div>
  );
}
