import type { Metadata } from "next";
import { MOCK_ACTIVITY_FEED } from "@/features/activity/lib/mock-activity-feed";
import { ActivityFeed } from "@/features/activity/ui/activity-feed";

export const metadata: Metadata = { title: "Actividad" };

/**
 * Full chronological feed of the group, no algorithm (docs/screens.md#actividad,
 * docs/domain.md#feed-de-actividad) — distinct from the three-line teaser on
 * /inicio.
 */
export default async function ActivityPage() {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Actividad</h1>
        <p className="text-ink-muted">Todo lo que ha pasado en el grupo.</p>
      </div>
      <ActivityFeed events={MOCK_ACTIVITY_FEED} />
    </section>
  );
}
