"use client";

import { useEffect, useId, useState } from "react";
import { Settings, X } from "reicon-react";
import { activityStatsByCategory } from "@/features/profile/lib/activity-stats";
import { recommendationsForMember } from "@/features/profile/lib/recommendation";
import { Dialog } from "@/shared/ui/dialog";
import { ActivitySection } from "./activity-section";
import { EditProfileDialog } from "./edit-profile-dialog";
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
  /** Clerk's given name, for the edit form. Falls back to the display name. */
  firstName?: string;
  /** Clerk's family name, for the edit form. */
  lastName?: string;
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

/**
 * Your own profile: the header, the section preference editor, and the
 * sections themselves. There is no library or recommendations endpoint yet
 * (docs/roadmap.md), so every section starts from empty data and each one
 * renders its own honest empty state.
 */
export function OwnProfileView({
  displayName,
  firstName,
  lastName,
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
      <ProfileHeader
        displayName={displayName}
        username={username}
        avatarUrl={avatarUrl}
        memberSince={memberSince}
        actions={
          <>
            <EditProfileDialog
              firstName={firstName ?? displayName}
              lastName={lastName ?? ""}
              username={username}
              avatarUrl={avatarUrl}
            />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm text-ink-muted transition-colors duration-150 hover:border-accent hover:text-ink"
            >
              <Settings size={15} aria-hidden="true" />
              Editar secciones
            </button>
          </>
        }
      />

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
            className="text-[15px] text-ink-muted transition-opacity hover:opacity-80"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <EditSectionsPanel
          order={preferences.order}
          visibleSections={preferences.visibleSections}
          defaultSection={preferences.defaultSection}
          onChange={handleChange}
        />
      </Dialog>

      <SectionTabs
        visibleSections={preferences.visibleSections}
        order={preferences.order}
        defaultSection={preferences.defaultSection}
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
