import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { HomeDashboard } from "@/features/home/ui/home-dashboard";
import type { Member } from "@/shared/api/types";
import { ApiError, apiFetch } from "@/shared/lib/api-client";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Personal panel: what's in progress, pending recommendations, recent
 * activity (docs/screens.md#inicio). None of those have a real endpoint yet
 * (docs/roadmap.md), so `HomeDashboard` renders its empty states. The API
 * status block below is the real smoke test for the stack and stays wired
 * to the actual endpoint.
 */
export default async function HomePage() {
  const { getToken } = await auth();
  const token = await getToken();
  const user = await currentUser();
  const displayName = user?.fullName ?? user?.username ?? "";

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
    <section className="space-y-8">
      <HomeDashboard
        displayName={displayName}
        inProgressWorks={[]}
        recommendations={[]}
        activity={[]}
      />

      <div className="rounded-xl border border-border bg-surface-raised p-5">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-muted">
          Estado de la conexión con la API
        </h2>
        {profile ? (
          <p className="mt-2 text-sm">
            Sesión verificada por la API como{" "}
            <span className="font-mono">@{profile.username}</span>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Sin respuesta de la API ({error}). Arranca el backend con{" "}
            <code className="font-mono">pnpm api:dev</code>.
          </p>
        )}
      </div>
    </section>
  );
}
