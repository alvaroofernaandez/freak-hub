import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toLibraryItem } from "@/features/library/lib/library-item";
import { EntryEditor } from "@/features/library/ui/entry-editor";
import { EntrySummary } from "@/features/library/ui/entry-summary";
import { WorkPageHeader } from "@/features/library/ui/work-page-header";
import type { LibraryEntry } from "@/shared/api/types";
import { loadResource } from "@/shared/lib/load-resource";
import { SetActiveCategory } from "@/shared/ui/active-category";
import { AccountPendingState } from "@/shared/ui/state/account-pending-state";
import { ErrorState } from "@/shared/ui/state/error-state";
import { SessionExpiredState } from "@/shared/ui/state/session-expired-state";

export const metadata: Metadata = { title: "Obra" };

type WorkPageProps = {
  params: Promise<{ id: string }>;
};

/**
 * One library entry's own page (docs/screens.md, ADR-0006, ADR-0007).
 *
 * The `[id]` segment is the **entry's** id, not the work's: the page reads
 * `GET /v1/library/{id}`, which is the caller's own entry with its `Work`
 * embedded. Until the library endpoint was consumed this called `notFound()`
 * for every id, because no id could be confirmed real.
 *
 * `library_entry_not_found` is now a real 404. The contract answers it both
 * for an entry that never existed and for one belonging to somebody else, on
 * purpose — a `403` would confirm the entry exists, and whose library holds
 * what is nobody else's business. Every other failure is a state on the page,
 * never a 404: "the server is down" and "this does not exist" are different
 * things to tell somebody.
 *
 * "Tu entrada" is editable from the write half of issue #73: status,
 * progress, rating, favourite and ownership go out as a `PATCH` carrying
 * only what changed, and the entry can be removed. The dates and the note
 * stay read-only — same endpoint, outside that change's scope.
 */
export default async function WorkPage({ params }: WorkPageProps) {
  const { id } = await params;
  const { getToken } = await auth();
  const token = await getToken();

  const state = await loadResource<LibraryEntry>(`/v1/library/${id}`, {
    token,
    resource: "esta obra",
    route: "/obras/[id]",
  });

  if (state.status === "error") {
    if (state.error.kind === "session_expired") {
      return <SessionExpiredState size="page" redirectPath={`/obras/${id}`} />;
    }
    // `unknown_identity` shares this endpoint's 404, and `normalizeError`
    // already tells the two apart: the session is real, the member row is
    // just not there yet.
    if (state.error.kind === "account_pending") {
      return <AccountPendingState size="page" />;
    }
    if (state.error.kind === "not_found") {
      notFound();
    }

    return <ErrorState error={state.error} size="page" />;
  }

  const item = toLibraryItem(state.data);

  return (
    <section className="space-y-[30px]">
      <SetActiveCategory category={item.category} />
      <WorkPageHeader item={item} />
      <EntryEditor item={item}>
        <EntrySummary item={item} />
      </EntryEditor>
    </section>
  );
}
