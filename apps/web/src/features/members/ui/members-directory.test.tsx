import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MembersDirectory } from "./members-directory";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const MEMBERS = [
  {
    id: "1",
    username: "alvaro",
    displayName: "Álvaro Fernández",
    avatarUrl: null,
    memberSince: "2026-01-04T00:00:00.000Z",
  },
  {
    id: "2",
    username: "francisco",
    displayName: "Francisco Bermejo",
    avatarUrl: null,
    memberSince: "2026-02-11T00:00:00.000Z",
  },
];

const INVITATIONS = [
  {
    id: "i1",
    email: "amigo@correo.com",
    status: "pending" as const,
    createdAt: "2026-03-01T00:00:00.000Z",
    invitedBy: "Álvaro Fernández",
  },
];

describe("MembersDirectory", () => {
  it("tells the roster which row is yours", () => {
    render(
      <MembersDirectory
        members={MEMBERS}
        invitations={[]}
        currentUsername="francisco"
      />,
    );

    const yours = screen.getByText("Tú").closest("a");
    expect(yours).toHaveAttribute("href", "/miembros/francisco");
  });

  it("lays the roster out in a grid that adapts to how many there are", () => {
    render(<MembersDirectory members={MEMBERS} invitations={[]} />);

    const grid = screen.getByTestId("members-grid");
    expect(grid.className).toMatch(/auto-fill/);
  });

  it("counts the members it is showing", () => {
    render(<MembersDirectory members={MEMBERS} invitations={[]} />);

    const section = screen
      .getByRole("heading", { level: 2, name: /^miembros$/i })
      .closest("section");
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText("2")).toBeInTheDocument();
  });

  it("lists every member, each linking to their profile", () => {
    render(<MembersDirectory members={MEMBERS} invitations={[]} />);

    expect(
      screen.getByRole("link", { name: /álvaro fernández/i }),
    ).toHaveAttribute("href", "/miembros/alvaro");
    expect(
      screen.getByRole("link", { name: /francisco bermejo/i }),
    ).toHaveAttribute("href", "/miembros/francisco");
  });

  it("cascades member rows and pending invitations in, each a beat after the last", () => {
    render(<MembersDirectory members={MEMBERS} invitations={INVITATIONS} />);

    const first = screen
      .getByRole("link", { name: /álvaro fernández/i })
      .closest("[data-testid='member-row-slot']") as HTMLElement;
    const second = screen
      .getByRole("link", { name: /francisco bermejo/i })
      .closest("[data-testid='member-row-slot']") as HTMLElement;
    expect(first).toHaveClass("stagger-in");
    expect(first.style.getPropertyValue("--i")).toBe("0");
    expect(second.style.getPropertyValue("--i")).toBe("1");

    const invitationRow = screen.getByText("amigo@correo.com").closest("li");
    expect(invitationRow).toHaveClass("stagger-in");
  });

  it("lists who has been invited but has not walked in yet", () => {
    render(<MembersDirectory members={MEMBERS} invitations={INVITATIONS} />);

    expect(screen.getByText("amigo@correo.com")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  it("says so plainly when nobody is waiting to join, via the system's empty state (not a bespoke dashed box)", () => {
    render(<MembersDirectory members={MEMBERS} invitations={[]} />);

    expect(
      screen.getByRole("heading", { name: /no hay invitaciones pendientes/i }),
    ).toBeInTheDocument();
  });

  it("hides the pending section entirely when invitations could not be loaded", () => {
    render(<MembersDirectory members={MEMBERS} invitations={null} />);

    expect(
      screen.queryByRole("heading", { name: /invitaciones/i }),
    ).not.toBeInTheDocument();
  });

  it("offers the invite action from the page header", () => {
    render(<MembersDirectory members={MEMBERS} invitations={[]} />);

    expect(
      screen.getByRole("button", { name: /invitar/i }),
    ).toBeInTheDocument();
  });

  it("says the group is empty rather than showing a bare grid", () => {
    render(<MembersDirectory members={[]} invitations={[]} />);

    expect(
      screen.getByRole("heading", { name: /todavía no hay nadie/i }),
    ).toBeInTheDocument();
  });

  it("shows a retryable section error for invitations, instead of hiding the section, when one is given", () => {
    render(
      <MembersDirectory
        members={MEMBERS}
        invitations={null}
        invitationsError={{
          kind: "service_unavailable",
          severity: "critical",
          scope: "section",
          code: "upstream_unavailable",
          retryable: true,
          copy: {
            title: "No se han podido cargar las invitaciones",
            description: "Vuelve a intentarlo.",
          },
          recovery: { kind: "retry" },
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Invitaciones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "No se han podido cargar las invitaciones",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });

  it("notes there are more members than shown, instead of truncating silently", () => {
    render(
      <MembersDirectory members={MEMBERS} invitations={[]} membersHasMore />,
    );

    expect(screen.getByText(/hay más miembros/i)).toBeInTheDocument();
  });

  it("notes there are more invitations than shown, instead of truncating silently", () => {
    render(
      <MembersDirectory
        members={MEMBERS}
        invitations={INVITATIONS}
        invitationsHasMore
      />,
    );

    expect(screen.getByText(/hay más invitaciones/i)).toBeInTheDocument();
  });
});
