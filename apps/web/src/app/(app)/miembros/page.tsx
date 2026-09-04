import { currentUser } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { MOCK_MEMBERS } from "@/features/members/lib/mock-members";
import { MemberRow } from "@/features/members/ui/member-row";

export const metadata: Metadata = { title: "Grupo" };

/** Who is inside the group (docs/screens.md#grupo): you, plus the mock members. */
export default async function MembersPage() {
  const user = await currentUser();

  const you =
    user?.username != null
      ? [
          {
            username: user.username,
            displayName: user.fullName ?? user.username,
            avatarUrl: user.imageUrl,
          },
        ]
      : [];

  const members = [
    ...you,
    ...MOCK_MEMBERS.map((member) => ({ ...member, avatarUrl: null })),
  ];

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Grupo</h1>
        <p className="text-ink-muted">Quién está dentro.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {members.map((member) => (
          <MemberRow
            key={member.username}
            username={member.username}
            displayName={member.displayName}
            avatarUrl={member.avatarUrl}
          />
        ))}
      </div>
    </section>
  );
}
