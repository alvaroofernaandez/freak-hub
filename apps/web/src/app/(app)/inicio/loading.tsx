const RAIL_CARDS = ["a", "b", "c"];

/**
 * Shown while `/inicio` fetches the connection-status check. A skeleton
 * mirrors the page's structure (greeting, "Sigue donde lo dejaste" rail,
 * connection card) so nothing jumps when the real content lands; screen
 * readers get one polite "Cargando…" instead of reading every placeholder
 * shape.
 */
export default function LoadingHome() {
  return (
    <section className="space-y-8">
      <output className="sr-only">Cargando…</output>

      <div aria-hidden="true" className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded bg-border-soft motion-reduce:animate-none" />
        <div className="h-3.5 w-64 animate-pulse rounded bg-border-soft motion-reduce:animate-none" />
      </div>

      <div aria-hidden="true" className="space-y-4">
        <div className="h-3.5 w-40 animate-pulse rounded bg-border-soft motion-reduce:animate-none" />
        <div className="flex gap-4">
          {RAIL_CARDS.map((card) => (
            <div
              key={card}
              className="h-40 w-56 shrink-0 animate-pulse rounded-xl bg-border-soft motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="h-20 animate-pulse rounded-xl border border-border bg-surface-raised motion-reduce:animate-none"
      />
    </section>
  );
}
