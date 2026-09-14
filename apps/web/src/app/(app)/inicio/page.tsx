import { auth, currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { HomeDashboard } from "@/features/home/ui/home-dashboard";
import { toLibraryItem } from "@/features/library/lib/library-item";
import type { LibraryEntryPage, Member } from "@/shared/api/types";
import { loadResource } from "@/shared/lib/load-resource";
import { AccountPendingState } from "@/shared/ui/state/account-pending-state";
import { ErrorState } from "@/shared/ui/state/error-state";
import { SessionExpiredState } from "@/shared/ui/state/session-expired-state";

export const metadata: Metadata = { title: "Inicio" };

/** The contract's page-size maximum (docs/api.md#paginación). */
const PAGE_LIMIT = 100;

/**
 * Personal panel: what's in progress, pending recommendations, recent
 * activity (docs/screens.md#inicio).
 *
 * The rail is real now: `GET /v1/library?status=in_progress` is exactly the
 * question "sigue donde lo dejaste" asks, so there is no client-side sifting
 * of a whole library to do it. **Recommendations and activity stay empty** —
 * neither has an endpoint, and filling them with anything would be inventing
 * data the product does not have.
 *
 * The two requests are independent on purpose: losing the rail should not
 * cost the panel, and losing the profile check should not empty the rail.
 */
export default async function HomePage() {
  const { getToken } = await auth();
  const token = await getToken();

  const [profileState, railState, user] = await Promise.all([
    loadResource<Member>("/v1/me", {
      token,
      resource: "la conexión con la API",
      route: "/inicio",
      scope: "section",
    }),
    loadResource<LibraryEntryPage>(
      `/v1/library?status=in_progress&limit=${PAGE_LIMIT}`,
      {
        token,
        resource: "lo que tienes en curso",
        route: "/inicio",
        scope: "section",
      },
    ),
    currentUser(),
  ]);

  const displayName = user?.fullName ?? user?.username ?? "";
  const profile = profileState.status === "ready" ? profileState.data : null;
  const normalized =
    profileState.status === "error" ? profileState.error : null;
  const railError = railState.status === "error" ? railState.error : null;

  // docs/states.md fixes the order when several states collide: session,
  // then an account that is not ready, before anything about a particular
  // section. Both requests carry the same session, so a 401 is the page's
  // answer — not the same message printed twice, once per failed section.
  if (
    normalized?.kind === "session_expired" ||
    railError?.kind === "session_expired"
  ) {
    return <SessionExpiredState size="page" redirectPath="/inicio" />;
  }
  if (
    normalized?.kind === "account_pending" ||
    railError?.kind === "account_pending"
  ) {
    return <AccountPendingState size="page" />;
  }

  return (
    <section className="space-y-8">
      <HomeDashboard
        displayName={displayName}
        inProgressItems={
          railState.status === "ready"
            ? railState.data.items.map(toLibraryItem)
            : []
        }
        inProgressError={railError}
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
          ) : normalized ? (
            <ErrorState error={normalized} size="inline" />
          ) : null}
        </div>
      </div>
    </section>
  );
}
