import Link from "next/link";
import type { MockActivityEvent } from "@/features/activity/lib/mock-activity-feed";
import { findMember } from "@/features/members/lib/mock-members";
import { Avatar } from "@/features/members/ui/avatar";

type ActivityFeedProps = {
  events: MockActivityEvent[];
};

const timestampFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** The full, chronological group feed (docs/screens.md#actividad, docs/domain.md#feed-de-actividad). */
export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <ul className="space-y-3">
      {events.map((event) => {
        const member = findMember(event.actorUsername);
        const displayName = member?.displayName ?? event.actorUsername;

        return (
          <li
            key={event.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface-raised p-3"
          >
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
              <Avatar displayName={displayName} />
            </div>
            <div className="flex-1 space-y-0.5">
              <p>
                <Link
                  href={`/miembros/${event.actorUsername}`}
                  className="font-medium"
                >
                  {displayName}
                </Link>{" "}
                <span className="text-ink-muted">{event.text}</span>
              </p>
              <time
                dateTime={event.timestamp}
                className="block font-mono text-xs text-ink-muted"
              >
                {timestampFormatter.format(new Date(event.timestamp))}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
