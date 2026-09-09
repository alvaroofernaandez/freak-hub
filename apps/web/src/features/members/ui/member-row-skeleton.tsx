/**
 * Placeholder for a member row while the roster loads. It mirrors `MemberRow`'s
 * shell exactly (same radius, border, padding and 40px avatar slot) so the list
 * does not reflow when the real data arrives.
 */
export function MemberRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-3.5 rounded-xl border border-border bg-surface-raised p-3.5"
    >
      <div
        data-testid="member-row-skeleton-avatar"
        className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-border-soft motion-reduce:animate-none"
      />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-32 animate-pulse rounded bg-border-soft motion-reduce:animate-none" />
        <div className="h-3 w-20 animate-pulse rounded bg-border-soft motion-reduce:animate-none" />
      </div>
    </div>
  );
}
