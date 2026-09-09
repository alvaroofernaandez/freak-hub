import { MemberRowSkeleton } from "@/features/members/ui/member-row-skeleton";

/** Enough rows to fill the fold without pretending to know the real count. */
const SKELETON_ROWS = ["a", "b", "c", "d"];

/**
 * Shown while the roster is being fetched. A skeleton rather than a spinner:
 * the shape of the answer is already known, so the page can reserve it and
 * avoid the jump when the data lands.
 */
export default function LoadingMembers() {
  return (
    <section className="space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Grupo</h1>
        <p className="text-ink-muted">Quién está dentro.</p>
      </div>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {SKELETON_ROWS.map((row) => (
          <MemberRowSkeleton key={row} />
        ))}
      </div>
    </section>
  );
}
