import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const currentUser = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ currentUser: () => currentUser() }));

const { default: ProfilePage } = await import("./page");

describe("ProfilePage", () => {
  beforeEach(() => {
    notFound.mockClear();
    currentUser.mockReset();
  });

  it("renders your own profile, with the edit control, when the username matches you", async () => {
    currentUser.mockResolvedValue({
      username: "edward",
      fullName: "Edward Elric",
      imageUrl: "https://example.com/ed.png",
    });

    const page = await ProfilePage({
      params: Promise.resolve({ username: "edward" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", { name: "Edward Elric" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /editar secciones/i }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("renders a mock friend's profile, without the edit control, when it is not you", async () => {
    currentUser.mockResolvedValue({
      username: "edward",
      fullName: "Edward Elric",
      imageUrl: null,
    });

    const page = await ProfilePage({
      params: Promise.resolve({ username: "gon" }),
    });
    render(page);

    expect(
      screen.getByRole("heading", { name: "Gon Freecss" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /editar secciones/i }),
    ).not.toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("calls notFound for a username that is neither you nor a known member", async () => {
    currentUser.mockResolvedValue({
      username: "edward",
      fullName: "Edward Elric",
      imageUrl: null,
    });

    await ProfilePage({
      params: Promise.resolve({ username: "no-existe" }),
    });

    expect(notFound).toHaveBeenCalled();
  });
});
