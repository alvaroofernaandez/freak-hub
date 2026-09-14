import { describe, expect, it } from "vitest";
import type {
  GroupInvitationPage,
  InvitationPage,
  MemberPage,
} from "@/shared/api/types";

/**
 * These assertions run at typecheck time, not only at runtime: each literal
 * below is annotated with the type the contract generated, so a page envelope
 * that loses `next_cursor` — or that goes back to being a bare array — fails
 * `pnpm typecheck` instead of failing in a browser.
 *
 * ADR-0011 fixes one shape for every listing. `GET /v1/invitations` was the
 * endpoint left out of it, so it is the one worth pinning here alongside its
 * two siblings.
 */
describe("the ADR-0011 page envelope", () => {
  it("reads the last page of invitations as items plus a null next_cursor", () => {
    const lastPage: InvitationPage = { items: [], next_cursor: null };

    expect(lastPage.items).toEqual([]);
    expect(lastPage.next_cursor).toBeNull();
  });

  it("carries the cursor to ask for the next page of invitations", () => {
    const page: InvitationPage = {
      items: [
        {
          id: "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0",
          email: "amigo@correo.com",
          status: "pending",
          inviter_id: "1a2b3c4d-5e6f-7081-9293-a4b5c6d7e8f9",
          created_at: "2026-01-01T00:00:00Z",
        },
      ],
      next_cursor: "eyJ0IjoiMjAyNi0wMS0wMVQwMDowMDowMFoifQ",
    };

    expect(page.items).toHaveLength(1);
    expect(page.next_cursor).not.toBeNull();
  });

  it("is the same shape for every listing, not one per endpoint", () => {
    const pages: Array<
      Pick<InvitationPage | MemberPage | GroupInvitationPage, "next_cursor">
    > = [
      { next_cursor: null } satisfies Pick<InvitationPage, "next_cursor">,
      { next_cursor: null } satisfies Pick<MemberPage, "next_cursor">,
      { next_cursor: null } satisfies Pick<GroupInvitationPage, "next_cursor">,
    ];

    expect(pages.every((page) => page.next_cursor === null)).toBe(true);
  });
});
