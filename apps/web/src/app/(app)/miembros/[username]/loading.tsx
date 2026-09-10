/**
 * Shown while a member's profile loads. Mirrors the header (avatar, name,
 * "member since") plus the section tabs strip, so the layout does not jump
 * when the real profile lands.
 */
export default function LoadingProfile() {
  return (
    <section className="space-y-8">
      <output className="sr-only">Cargando…</output>

      <div aria-hidden="true" className="flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 animate-pulse rounded-full bg-border-soft motion-reduce:animate-none" />
        <div className="space-y-2">
          <div className="h-5 w-40 animate-pulse rounded bg-border-soft motion-reduce:animate-none" />
          <div className="h-3.5 w-56 animate-pulse rounded bg-border-soft motion-reduce:animate-none" />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="flex gap-1 border-b border-border pb-2.5"
      >
        <div className="h-4 w-20 animate-pulse rounded bg-border-soft motion-reduce:animate-none" />
        <div className="h-4 w-20 animate-pulse rounded bg-border-soft motion-reduce:animate-none" />
        <div className="h-4 w-20 animate-pulse rounded bg-border-soft motion-reduce:animate-none" />
      </div>
    </section>
  );
}
