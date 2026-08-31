import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import type { Member } from "@/shared/api/types";
import { ApiError, apiFetch } from "@/shared/lib/api-client";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Smoke screen for the whole stack: it proves the Clerk session reaches the Go
 * API and that the API resolved it to a row in Postgres. Replace it with the
 * real dashboard when the first domain feature lands.
 */
export default async function HomePage() {
  const { getToken } = await auth();
  const token = await getToken();

  let profile: Member | null = null;
  let error: string | null = null;

  try {
    profile = await apiFetch<Member>("/v1/me", { token });
  } catch (cause) {
    error =
      cause instanceof ApiError
        ? `${cause.status} · ${cause.code}`
        : "No se pudo contactar con la API";
  }

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Tu biblioteca</h1>
        <p className="text-content-muted">
          Todavía no hay nada que registrar. Las colecciones, la lista de
          pendientes y las recomendaciones llegarán en las siguientes entregas.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h2 className="font-mono text-xs uppercase tracking-widest text-content-muted">
          Estado de la conexión con la API
        </h2>
        {profile ? (
          <p className="mt-2 text-sm">
            Sesión verificada por la API como{" "}
            <span className="font-mono">@{profile.username}</span>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-content-muted">
            Sin respuesta de la API ({error}). Arranca el backend con{" "}
            <code className="font-mono">pnpm api:dev</code>.
          </p>
        )}
      </div>
    </section>
  );
}
