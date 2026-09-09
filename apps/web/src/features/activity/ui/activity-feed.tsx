import Link from "next/link";
import type {
  ActivityEvent,
  ActivityEventType,
} from "@/features/activity/lib/activity-event";
import { Avatar } from "@/features/members/ui/avatar";
import { EmptyState } from "@/shared/ui/empty-state";

type ActivityFeedProps = {
  events: ActivityEvent[];
};

/**
 * One mark per kind of event. Typographic marks, not emoji, matching the
 * status vocabulary in docs/design.md. Colour plays no part: it is already
 * spent on category.
 */
const EVENT_ICON: Record<ActivityEventType, string> = {
  rating: "\u25c6",
  favourite: "\u2605",
  status: "\u25d0",
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
  if (events.length === 0) {
    return (
      <EmptyState
        title="Sin actividad todavía"
        description="Aquí aparecerá lo que vaya pasando en el grupo."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {events.map((event) => {
        const displayName = event.actorDisplayName ?? event.actorUsername;

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
                {event.type ? (
                  <span
                    data-testid="activity-event-icon"
                    aria-hidden="true"
                    className="mr-1.5 text-ink-muted"
                  >
                    {EVENT_ICON[event.type]}
                  </span>
                ) : null}
                <Link
                  href={`/miembros/${event.actorUsername}`}
                  className="font-medium transition-colors duration-150 hover:text-accent"
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
