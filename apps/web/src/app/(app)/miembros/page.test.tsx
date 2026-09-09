import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GroupInvitationPage, MemberPage } from "@/shared/api/types";

const getToken = vi.fn();
const currentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  auth: () => Promise.resolve({ getToken }),
  currentUser: () => currentUser(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const apiFetch = vi.fn();
vi.mock("@/shared/lib/api-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/lib/api-client")
  >("@/shared/lib/api-client");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const { default: MembersPage } = await import("./page");

const ROSTER: MemberPage = {
  items: [
    {
      id: "1",
      clerk_user_id: "user_1",
      username: "alvaro",
      display_name: "Álvaro Fernández",
      created_at: "2026-01-04T00:00:00.000Z",
    },
  ],
  next_cursor: null,
};

const INVITER = {
  id: "1",
  username: "alvaro",
  display_name: "Álvaro Fernández",
};

const INVITATIONS: GroupInvitationPage = {
  items: [
    {
      id: "i1",
      email: "pendiente@correo.com",
      status: "pending",
      created_at: "2026-03-01T00:00:00.000Z",
      inviter: INVITER,
    },
    {
      id: "i2",
      email: "yaentro@correo.com",
      status: "accepted",
      created_at: "2026-02-01T00:00:00.000Z",
      inviter: INVITER,
    },
  ],
  next_cursor: null,
};

/** Answers each endpoint with its own payload, regardless of call order. */
function respondWith(
  roster: unknown | Error,
  invitations: unknown | Error,
): void {
  apiFetch.mockImplementation((path: string) => {
    const payload = path.startsWith("/v1/members") ? roster : invitations;
    return payload instanceof Error
      ? Promise.reject(payload)
      : Promise.resolve(payload);
  });
}

describe("MembersPage", () => {
  it("marks the reader's own row in the roster", async () => {
    respondWith(ROSTER, INVITATIONS);

    render(await MembersPage());

    expect(screen.getByText("Tú").closest("a")).toHaveAttribute(
      "href",
      "/miembros/alvaro",
    );
  });

  it("marks nobody when there is no signed-in identity to match", async () => {
    currentUser.mockResolvedValue(null);
    respondWith(ROSTER, INVITATIONS);

    render(await MembersPage());

    expect(screen.queryByText("Tú")).not.toBeInTheDocument();
  });

  beforeEach(() => {
    apiFetch.mockReset();
    getToken.mockReset();
    getToken.mockResolvedValue("session-token");
    currentUser.mockReset();
    currentUser.mockResolvedValue({ username: "alvaro" });
  });

  it("asks for both the roster and the group's invitations", async () => {
    respondWith(ROSTER, INVITATIONS);

    render(await MembersPage());

    expect(apiFetch).toHaveBeenCalledWith("/v1/members", {
      token: "session-token",
    });
    expect(apiFetch).toHaveBeenCalledWith("/v1/invitations/group", {
      token: "session-token",
    });
  });

  it("lists the members it got back", async () => {
    respondWith(ROSTER, INVITATIONS);

    render(await MembersPage());

    expect(
      screen.getByRole("link", { name: /álvaro fernández/i }),
    ).toHaveAttribute("href", "/miembros/alvaro");
  });

  it("shows only the people who have not walked in yet", async () => {
    respondWith(ROSTER, INVITATIONS);

    render(await MembersPage());

    expect(screen.getByText("pendiente@correo.com")).toBeInTheDocument();
    // Already a member: showing it under "invitations" would double-count them.
    expect(screen.queryByText("yaentro@correo.com")).not.toBeInTheDocument();
  });

  it("credits who sent each pending invitation", async () => {
    respondWith(ROSTER, INVITATIONS);

    render(await MembersPage());

    expect(
      screen.getByText(/invitada por álvaro fernández/i),
    ).toBeInTheDocument();
  });

  it("still shows the roster when the invitations fail to load", async () => {
    respondWith(ROSTER, new Error("boom"));

    render(await MembersPage());

    expect(
      screen.getByRole("link", { name: /álvaro fernández/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /invitaciones/i }),
    ).not.toBeInTheDocument();
  });

  it("says the group could not be loaded when the roster fails", async () => {
    respondWith(new Error("boom"), INVITATIONS);

    render(await MembersPage());

    expect(
      screen.getByRole("heading", { name: /no se ha podido cargar el grupo/i }),
    ).toBeInTheDocument();
  });
});
