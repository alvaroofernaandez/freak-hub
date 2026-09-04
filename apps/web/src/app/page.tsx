import { Show } from "@clerk/nextjs";
import Link from "next/link";

/**
 * Public landing. Deliberately minimal: the visual direction is still open, so
 * this page only has to explain what Freak Hub is and route people to auth.
 */
export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-4">
        <p className="font-mono text-sm uppercase tracking-widest text-ink-muted">
          Comunidad cerrada
        </p>
        <h1 className="text-balance text-4xl font-semibold sm:text-5xl">
          Freak Hub
        </h1>
        <p className="text-pretty text-lg text-ink-muted">
          La biblioteca compartida del grupo. Registra lo que ves, lees y
          juegas, apunta lo que tienes pendiente y descubre qué recomiendan los
          demás.
        </p>
      </header>

      <Show when="signed-out">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/entrar"
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-ink transition-colors hover:opacity-90"
          >
            Entrar
          </Link>
          <Link
            href="/registro"
            className="rounded-lg border border-border px-5 py-2.5 font-medium transition-colors hover:bg-surface-raised"
          >
            Tengo una invitación
          </Link>
        </div>
        <p className="text-sm text-ink-muted">
          El registro está cerrado: solo se entra con una invitación de alguien
          que ya esté dentro.
        </p>
      </Show>

      <Show when="signed-in">
        <Link
          href="/inicio"
          className="w-fit rounded-lg bg-accent px-5 py-2.5 font-medium text-accent-ink transition-colors hover:opacity-90"
        >
          Ir a mi biblioteca
        </Link>
      </Show>
    </main>
  );
}
