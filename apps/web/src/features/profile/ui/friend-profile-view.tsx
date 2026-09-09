import { activityStatsByCategory } from "@/features/profile/lib/activity-stats";
import { recommendationsForMember } from "@/features/profile/lib/recommendation";
import { ActivitySection } from "./activity-section";
import { LibrarySection } from "./library-section";
import { ProfileHeader } from "./profile-header";
import { RecommendationsSection } from "./recommendations-section";
import { SECTION_ORDER, SectionTabs } from "./section-tabs";
import { TopSection } from "./top-section";

type FriendProfileViewProps = {
  displayName: string;
  username: string;
  /** ISO 8601 timestamp of when the member joined the group (see ProfileHeader). */
  memberSince?: string;
};

/**
 * A friend's profile: the four sections, always all visible, no editing
 * (ADR-0010). There is no library or recommendations endpoint yet
 * (docs/roadmap.md), so every section starts from empty data and each one
 * renders its own honest empty state.
 */
export function FriendProfileView({
  displayName,
  username,
  memberSince,
}: FriendProfileViewProps) {
  return (
    <div className="space-y-8">
      <ProfileHeader
        displayName={displayName}
        username={username}
        memberSince={memberSince}
      />
      <SectionTabs
        visibleSections={SECTION_ORDER}
        defaultSection="library"
        sections={{
          library: <LibrarySection works={[]} />,
          activity: <ActivitySection stats={activityStatsByCategory([])} />,
          top: <TopSection works={[]} />,
          recommendations: (
            <RecommendationsSection
              recommendations={recommendationsForMember([], username)}
              ownerUsername={username}
            />
          ),
        }}
      />
    </div>
  );
}
