import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MOCK_WORKS } from "@/features/library/lib/mock-works";
import { WorkCard } from "@/features/library/ui/work-card";
import { CATEGORY_LABELS } from "@/shared/ui/category-stripe";
import { StatusBadge } from "@/shared/ui/status-badge";

type WorkPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({
  params,
}: WorkPageProps): Promise<Metadata> {
  const { id } = await params;
  const work = MOCK_WORKS.find((candidate) => candidate.id === id);
  return { title: work?.title ?? "" };
}

/**
 * A work's own page: your entry, plus conditional sections that only apply
 * to some categories (docs/screens.md, ADR-0006, ADR-0007).
 */
export default async function WorkPage({ params }: WorkPageProps) {
  const { id } = await params;
  const work = MOCK_WORKS.find((candidate) => candidate.id === id);

  if (!work) {
    notFound();
    return;
  }

  const expansions =
    work.category === "boardgame" && !work.expansionOf
      ? MOCK_WORKS.filter((candidate) => candidate.expansionOf === work.id)
      : [];
  const decks = work.category === "tcg" ? (work.decks ?? []) : [];

  return (
    <article className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          {CATEGORY_LABELS[work.category]}
        </p>
        <h1 className="text-3xl font-semibold">{work.title}</h1>
        <div className="flex flex-wrap items-center gap-4">
          <StatusBadge status={work.status} />
          {work.rating ? (
            <span className="font-mono text-sm text-ink-muted">
              {work.rating}/10
            </span>
          ) : null}
          {work.isFavourite ? (
            <span role="img" aria-label="Favorito" className="text-lg">
              ★
            </span>
          ) : null}
        </div>
      </header>

      {expansions.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Expansiones</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {expansions.map((expansion) => (
              <WorkCard key={expansion.id} work={expansion} />
            ))}
          </div>
        </section>
      ) : null}

      {decks.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Mazos</h2>
          <ul className="space-y-2">
            {decks.map((deck) => (
              <li
                key={deck}
                className="rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm"
              >
                {deck}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
