import { notFound } from "next/navigation";

type WorkPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * A work's own page (docs/screens.md, ADR-0006, ADR-0007). There is no
 * library endpoint yet (docs/roadmap.md), so there is no way to know
 * whether any given id is a real entry: every id is treated as not found,
 * with `notFound()`, rather than faking a work page for it. This is
 * deliberately a hard 404 and not an empty state, because an empty state
 * would claim the page exists with nothing in it, which isn't true either.
 */
export default async function WorkPage({ params }: WorkPageProps) {
  await params;
  notFound();
}
