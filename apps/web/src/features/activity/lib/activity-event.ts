/**
 * One entry in the group's activity feed (docs/domain.md#feed-de-actividad).
 * There is no real feed endpoint yet (docs/roadmap.md); this type is kept so
 * `ActivityFeed` has something to render once one exists.
 */
/**
 * What happened. Optional while there is no feed endpoint: an event whose
 * kind is unknown still renders, just without an icon.
 */
export type ActivityEventType = "rating" | "favourite" | "status";

export type ActivityEvent = {
  id: string;
  actorUsername: string;
  /** Resolved from the members roster; falls back to the handle when absent. */
  actorDisplayName?: string;
  type?: ActivityEventType;
  text: string;
  timestamp: string;
};
