"use client";

import { useEffect, useId, useState } from "react";
import { MOCK_WORKS } from "@/features/library/lib/mock-works";
import { activityStatsByCategory } from "@/features/profile/lib/mock-activity";
import {
  MOCK_RECOMMENDATIONS,
  recommendationsForMember,
} from "@/features/profile/lib/mock-recommendations";
import { Dialog } from "@/shared/ui/dialog";
import { ActivitySection } from "./activity-section";
import {
  EditSectionsPanel,
  type ProfilePreferences,
} from "./edit-sections-panel";
import { LibrarySection } from "./library-section";
import { ProfileHeader } from "./profile-header";
import { RecommendationsSection } from "./recommendations-section";
import { SECTION_ORDER, SectionTabs } from "./section-tabs";
import { TopSection } from "./top-section";

type OwnProfileViewProps = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  /** ISO 8601 timestamp of when the member joined the group (see ProfileHeader). */
  memberSince?: string;
};

/**
 * Temporary until the preferences endpoint exists (docs/roadmap.md): the
 * visible-sections/default-section choice lives in localStorage, keyed per
 * browser, not per member.
 */
const PREFERENCES_KEY = "freak-hub:profile-preferences";

const DEFAULT_PREFERENCES: ProfilePreferences = {
  visibleSections: SECTION_ORDER,
  defaultSection: "library",
};

function readStoredPreferences(): ProfilePreferences {
  try {
    const raw = window.localStorage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_PREFERENCES;
    }

    const parsed = JSON.parse(raw) as ProfilePreferences;
    if (
      !Array.isArray(parsed.visibleSections) ||
      parsed.visibleSections.length === 0
    ) {
      return DEFAULT_PREFERENCES;
    }

    return parsed;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Your own profile: the header, the section preference editor, and the sections themselves. */
export function OwnProfileView({
  displayName,
  username,
  avatarUrl,
  memberSince,
}: OwnProfileViewProps) {
  const [preferences, setPreferences] =
    useState<ProfilePreferences>(DEFAULT_PREFERENCES);
  const [editing, setEditing] = useState(false);
  const editSectionsTitleId = useId();

  useEffect(() => {
    setPreferences(readStoredPreferences());
  }, []);

  function handleChange(next: ProfilePreferences) {
    setPreferences(next);
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <ProfileHeader
          displayName={displayName}
          username={username}
          avatarUrl={avatarUrl}
          memberSince={memberSince}
        />
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-ink-muted"
        >
          ⚙ Editar secciones
        </button>
      </div>

      <Dialog
        isOpen={editing}
        onClose={() => setEditing(false)}
        titleId={editSectionsTitleId}
        maxWidthClassName="max-w-[560px]"
        panelClassName="p-[28px] gap-[18px]"
      >
        <div className="flex items-baseline justify-between">
          <h2
            id={editSectionsTitleId}
            className="text-[18px] font-bold text-ink"
          >
            Editar secciones de tu perfil
          </h2>
          <button
            type="button"
            aria-label="Cerrar"
            onClick={() => setEditing(false)}
            className="text-[15px] text-ink-faint transition-opacity hover:opacity-80"
          >
            ✕
          </button>
        </div>
        <EditSectionsPanel
          visibleSections={preferences.visibleSections}
          defaultSection={preferences.defaultSection}
          onChange={handleChange}
        />
      </Dialog>

      <SectionTabs
        visibleSections={preferences.visibleSections}
        defaultSection={preferences.defaultSection}
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
