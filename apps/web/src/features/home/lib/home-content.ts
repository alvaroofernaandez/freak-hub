/**
 * A recommendation waiting on the /inicio panel (docs/roadmap.md). There is
 * no recommendations endpoint yet; this type is kept so `HomeDashboard` has
 * something to render once one exists.
 */
export type PendingRecommendation = {
  id: string;
  workTitle: string;
  fromUsername: string;
  reason: string;
};

/**
 * One line of the /inicio recent-activity teaser (docs/roadmap.md). There is
 * no activity endpoint yet; this type is kept so `HomeDashboard` has
 * something to render once one exists.
 */
export type ActivityEntry = {
  id: string;
  text: string;
};
