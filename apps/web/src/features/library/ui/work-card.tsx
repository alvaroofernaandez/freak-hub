import Link from "next/link";
import { Star } from "reicon-react";
import {
  type LibraryItem,
  progressLabel,
} from "@/features/library/lib/library-item";
import { CoverPlaceholder } from "@/features/library/ui/cover-placeholder";
import { cn } from "@/shared/lib/cn";
import { interactiveCardClasses } from "@/shared/ui/interactive-card";
import { StatusBadge } from "@/shared/ui/status-badge";

type WorkCardProps = {
  item: LibraryItem;
};

/**
 * One library entry in a listing: a neutral card (docs/design/high-fidelity-desktop.html
 * §3 · BIBLIOTECA POR CATEGORÍA) with a cover placeholder (no cover art exists
 * yet, see docs/roadmap.md), the title below it, and then one line per fact:
 * status, rating, progress. Never two facts on one line — see the meta block.
 * `StatusBadge` is the only carrier of status meaning — category color plays
 * no part here (docs/design.md, same reasoning already applied to
 * `CategoryCard`, first in #23).
 *
 * The card links with the **entry's** id, not the work's: `/obras/[id]` reads
 * `GET /v1/library/{id}`.
 */
export function WorkCard({ item }: WorkCardProps) {
  const progress = progressLabel(item);

  return (
    <Link
      href={`/obras/${item.id}`}
      className={cn(
        // `h-full` so the card fills its grid cell. The lines inside are
        // aligned by the reserved title box, not by this; what this fixes is
        // the card outline itself, which otherwise shrank to its own content
        // and left short entries floating in a row of taller neighbours.
        "flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface",
        interactiveCardClasses(item.category),
      )}
    >
      <div className="relative">
        <CoverPlaceholder
          testId="work-card-cover"
          className="h-[150px] w-full rounded-none"
        />
        {item.isFavourite ? (
          <span
            role="img"
            aria-label="Favorito"
            className="absolute right-2 top-2 text-lg"
          >
            <Star size={18} weight="Filled" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {/* Two lines, always: clamped so a long title cannot run to four lines
            in a 148px column and drag its whole grid row with it (measured at
            1440px, card heights ranged 224–288px), and reserved so a short one
            still leaves the status, the rating and the progress on the same
            line as every other card in the grid. `2lh` rather than a fixed
            40px so the box follows the type scale instead of restating it.
            The full title stays reachable on hover and on the work page. */}
        <span
          data-testid="work-card-title"
          title={item.title}
          className="line-clamp-2 min-h-[2lh] font-display text-base leading-tight text-ink"
        >
          {item.title}
        </span>
        {/* One line per fact, never two facts per line (#76).
            `justify-between` only separates while there is room to spare: at
            1440px the row is 122px wide and `Abandonado` plus `10/10` needs
            157px, so the two ran together and the card clipped the tail —
            "Abandonado10," on screen. A column cannot do that at any width,
            and it is what the mockup draws at all three
            (docs/design/high-fidelity-desktop.html §3, desktop and mobile
            alike: `flex-direction:column; gap:6px`).

            Not bottom-anchored: with a reserved two-line title above it, the
            block starts at the same height on every card, so the status lines
            read across the grid as one row. Anchoring it to the bottom instead
            would align only the last line of each card, which is whichever of
            the three the entry happens to have. */}
        <div
          data-testid="work-card-meta"
          className="flex flex-col gap-1.5 break-words"
        >
          <StatusBadge status={item.status} />
          {/* Said in words, as the mockup says it (§8 · «Valoración: 9/10»):
              a bare "9/10" stacked over "12 / 64 episodios" is a second
              fraction in the same monospace, and a screen reader announces it
              with nothing to say what it counts. */}
          {item.rating === null ? null : (
            <span
              data-testid="work-card-rating"
              className="font-mono text-[11px] text-ink"
            >
              Valoración {item.rating}/10
            </span>
          )}
          {/* The mockup's progress line, which had nothing to print until the
              library endpoint landed. In `--ink-muted`, not the mockup's
              `--ink-faint`: that token does not clear 4.5:1 on this surface and
              `app/token-contrast.test.ts` refuses it for readable text. */}
          {progress ? (
            <span
              data-testid="work-card-progress"
              className="font-mono text-[11px] text-ink-muted"
            >
              {progress}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
