import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { HomeDashboard } from "@/features/home/ui/home-dashboard";
import type { Member } from "@/shared/api/types";
import { normalizeError } from "@/shared/errors/normalize-error";
import { reportError } from "@/shared/errors/report-error";
import type { NormalizedAppError } from "@/shared/errors/types";
import { apiFetch } from "@/shared/lib/api-client";
import { AccountPendingState } from "@/shared/ui/state/account-pending-state";
import { ErrorState } from "@/shared/ui/state/error-state";
import { SessionExpiredState } from "@/shared/ui/state/session-expired-state";

export const metadata: Metadata = { title: "Inicio" };

/**
 * Personal panel: what's in progress, pending recommendations, recent
 * activity (docs/screens.md#inicio). None of those have a real endpoint yet
 * (docs/roadmap.md), so `HomeDashboard` renders its empty states. The API
 * status block below is the real smoke test for the stack and stays wired
 * to the actual endpoint — its failure state is now normalized instead of
 * a raw `${status} · ${code}` string (ADR-0014).
 */
export default async function HomePage() {
  const { getToken } = await auth();
  const token = await getToken();
  const user = await currentUser();
  const displayName = user?.fullName ?? user?.username ?? "";

  let profile: Member | null = null;
  let normalized: NormalizedAppError | null = null;

  try {
    profile = await apiFetch<Member>("/v1/me", { token });
  } catch (cause) {
    normalized = normalizeError(cause, {
      resource: "la conexión con la API",
      operation: "load",
      scope: "section",
    });
    reportError(normalized, { route: "/inicio" });
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
        <div className="mt-2">
          {profile ? (
            <p className="text-sm">
              Sesión verificada por la API como{" "}
              <span className="font-mono">@{profile.username}</span>.
            </p>
          ) : normalized?.kind === "session_expired" ? (
            <SessionExpiredState size="inline" redirectPath="/inicio" />
          ) : normalized?.kind === "account_pending" ? (
            <AccountPendingState size="inline" />
          ) : normalized ? (
            <ErrorState error={normalized} size="inline" />
          ) : null}
        </div>
      </div>
    </section>
  );
}
