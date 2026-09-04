import { MOCK_WORKS } from "@/features/library/lib/mock-works";
import { activityStatsByCategory } from "@/features/profile/lib/mock-activity";
import {
  MOCK_RECOMMENDATIONS,
  recommendationsForMember,
} from "@/features/profile/lib/mock-recommendations";
import { ActivitySection } from "./activity-section";
import { LibrarySection } from "./library-section";
import { ProfileHeader } from "./profile-header";
import { RecommendationsSection } from "./recommendations-section";
import { SECTION_ORDER, SectionTabs } from "./section-tabs";
import { TopSection } from "./top-section";

type FriendProfileViewProps = {
  displayName: string;
  username: string;
};

/** A friend's profile: the four sections, always all visible, no editing (ADR-0010). */
export function FriendProfileView({
  displayName,
  username,
}: FriendProfileViewProps) {
  return (
    <div className="space-y-8">
      <ProfileHeader displayName={displayName} username={username} />
      <SectionTabs
        visibleSections={SECTION_ORDER}
        defaultSection="library"
        sections={{
          library: <LibrarySection works={MOCK_WORKS} />,
          activity: (
            <ActivitySection stats={activityStatsByCategory(MOCK_WORKS)} />
          ),
          top: <TopSection works={MOCK_WORKS} />,
          recommendations: (
            <RecommendationsSection
              recommendations={recommendationsForMember(
                MOCK_RECOMMENDATIONS,
                username,
              )}
              ownerUsername={username}
            />
          ),
        }}
      />
    </div>
  );
}
