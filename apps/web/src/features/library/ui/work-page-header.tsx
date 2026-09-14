import {
  type LibraryItem,
  progressLabel,
  progressPercentage,
} from "@/features/library/lib/library-item";
import { CoverPlaceholder } from "@/features/library/ui/cover-placeholder";
import type { WorkSource } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import {
  CATEGORY_ACCENT_CLASS,
  CATEGORY_LABELS,
} from "@/shared/ui/category-stripe";
import { ProgressBar } from "@/shared/ui/progress-bar";

/** The catalogue each work came from, as that catalogue calls itself. */
const SOURCE_LABELS: Record<WorkSource, string | null> = {
  anilist: "AniList",
  tmdb: "TMDB",
  igdb: "IGDB",
  bgg: "BoardGameGeek",
  scryfall: "Scryfall",
  // Typed in by a member: there is no catalogue to credit, and
  // "Fuente: manual" would be a line that tells nobody anything.
  manual: null,
};

const SEASON_NAMES: Record<string, string> = {
  winter: "Invierno",
  spring: "Primavera",
  summer: "Verano",
  fall: "Otoño",
  autumn: "Otoño",
};

/**
 * `metadata.season` arrives "as the catalogue labels it"
 * (packages/contracts/openapi.yaml, `WorkMetadata`), which for AniList is
 * `"2024-spring"`. The year is dropped because it is already the first item
 * of the same line, and anything that does not match the documented shape is
 * shown untouched rather than mangled.
 */
function seasonLabel(season: string): string {
  const match = /^\d{4}-([a-z]+)$/.exec(season);
  const name = match ? SEASON_NAMES[match[1]] : undefined;

  return name ?? season;
}

/**
 * The metadata line under the title: what the contract actually knows about
 * a work (`year`, and for anime the episode count and broadcast season from
 * its open `metadata` object). The mockup's boardgame line — play time,
 * player count, publisher — has no home in the contract, so it is not drawn:
 * those four fields used to come from a hand-written type that invented them.
 */
function metadataLine(item: LibraryItem): string | null {
  const episodes =
    item.category === "anime" && item.progressTotal !== null
      ? `${item.progressTotal} ${item.progressTotal === 1 ? "episodio" : "episodios"}`
      : null;
  const season =
    item.category === "anime" && item.season !== null
      ? seasonLabel(item.season)
      : null;

  const parts = [
    item.year === null ? null : String(item.year),
    episodes,
    season,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(" · ") : null;
}

type WorkPageHeaderProps = {
  item: LibraryItem;
};

/**
 * A work page's two-column header: a cover placeholder (no cover art yet,
 * see docs/roadmap.md) plus title, category pill, the metadata the contract
 * knows and the catalogue it came from
 * (docs/design/high-fidelity-desktop.html §4).
 */
export function WorkPageHeader({ item }: WorkPageHeaderProps) {
  const metadata = metadataLine(item);
  const percentage = progressPercentage(item);
  const progress = progressLabel(item);
  const source = SOURCE_LABELS[item.source];

  return (
    <div className="flex flex-col gap-[22px] md:flex-row md:gap-[22px] xl:gap-[30px]">
      <CoverPlaceholder
        testId="work-page-header-cover"
        className="h-[220px] w-full md:h-[230px] md:w-[170px] xl:h-[300px] xl:w-[220px]"
      />
      <div className="flex flex-col gap-2.5 md:gap-[9px] md:pt-1.5 xl:gap-3 xl:pt-2">
        <h1 className="text-2xl font-bold text-ink md:text-[23px] xl:text-3xl">
          {item.title}
        </h1>
        <span
          className={cn(
            "w-fit rounded-full border px-3 py-[5px] text-[11px] font-semibold md:px-[11px] md:py-1 md:text-[10px] xl:px-3 xl:py-[5px] xl:text-[11px]",
            CATEGORY_ACCENT_CLASS[item.category],
          )}
        >
          {CATEGORY_LABELS[item.category]}
        </span>
        {metadata ? (
          <p
            data-testid="work-page-header-metadata"
            className="text-xs text-ink-muted xl:text-[13px]"
          >
            {metadata}
          </p>
        ) : null}
        {progress ? (
          <p
            data-testid="work-page-header-progress"
            className="font-mono text-[11px] text-ink-muted xl:text-xs"
          >
            {progress}
          </p>
        ) : null}
        {/* A bar needs a total to be a share of. `progress` is an absolute
            count in the category's own unit, so without one the figure above
            is the whole honest answer (see `progressPercentage`). */}
        {percentage === null ? null : (
          <ProgressBar value={percentage} label={`Progreso de ${item.title}`} />
        )}
        {source ? (
          <p className="font-mono text-[10px] text-ink-muted xl:text-[11px]">
            Fuente: {source}
          </p>
        ) : null}
      </div>
    </div>
  );
}
