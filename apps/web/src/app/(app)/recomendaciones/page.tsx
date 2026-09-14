import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { RecommendationsView } from "@/features/recommendations/ui/recommendations-view";

export const metadata: Metadata = { title: "Recomendaciones" };

/**
 * Every recommendation of the member in session, split into what is waiting on
 * them and what they have sent (docs/screens.md#recomendaciones). The section
 * of the same name inside a profile is a different question — what the two of
 * you have exchanged (ADR-0010) — which is why this screen exists.
 *
 * No mockup exists for it, so it is composed out of pieces that are already
 * closed rather than invented: the page title pattern of /actividad, one
 * `SectionHeading` per block, the neutral card, the moulding as the separator
 * and the inline empty state
 * (docs/design.md#criterio-de-extensión-para-pantallas-sin-maqueta).
 *
 * It is protected by omission: `shared/lib/routes.ts` lists what is public and
 * /recomendaciones is deliberately not there.
 *
 * There is no recommendations endpoint yet (docs/roadmap.md), so the list is
 * empty and both blocks show their own honest empty state.
 */
export default async function RecommendationsPage() {
  const user = await currentUser();

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Recomendaciones</h1>
        <p className="max-w-[62ch] text-ink-muted text-pretty">
          Lo que el grupo te ha recomendado y lo que has recomendado tú, cada
          cosa con su motivo.
        </p>
      </div>

      <RecommendationsView
        recommendations={[]}
        viewerUsername={user?.username ?? ""}
      />
    </section>
  );
}
