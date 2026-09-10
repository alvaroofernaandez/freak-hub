import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberPage } from "@/shared/api/types";

const notFound = vi.fn();
vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/profile/actions/update-profile", () => ({
  updateProfile: vi.fn(async () => ({ status: "idle", message: "" })),
}));

const currentUser = vi.fn();
const getToken = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({
  currentUser: () => currentUser(),
  auth: () => Promise.resolve({ getToken }),
}));

const apiFetch = vi.fn();
vi.mock("@/shared/lib/api-client", async () => {
  const actual = await vi.importActual<
    typeof import("@/shared/lib/api-client")
  >("@/shared/lib/api-client");
  return { ...actual, apiFetch: (...args: unknown[]) => apiFetch(...args) };
});

const { default: ProfilePage } = await import("./page");
const { ApiError } = await import("@/shared/lib/api-client");

const ROSTER: MemberPage = {
  items: [
    {
      id: "1",
      clerk_user_id: "user_1",
      username: "edward",
      display_name: "Edward Elric",
      created_at: "2022-03-15T00:00:00.000Z",
    },
    {
      id: "2",
      clerk_user_id: "user_2",
      username: "gon",
      display_name: "Gon Freecss",
      created_at: "2023-09-10T00:00:00.000Z",
    },
  ],
  next_cursor: null,
};

function renderProfile(username: string) {
  return ProfilePage({ params: Promise.resolve({ username }) });
}

describe("ProfilePage", () => {
  beforeEach(() => {
    notFound.mockClear();
    currentUser.mockReset();
    apiFetch.mockReset();
    getToken.mockReset();
    getToken.mockResolvedValue("session-token");
    apiFetch.mockResolvedValue(ROSTER);
    currentUser.mockResolvedValue({
      username: "edward",
      fullName: "Edward Elric",
      firstName: "Edward",
      lastName: "Elric",
      imageUrl: null,
    });
  });

  it("hands your given and family names to the edit form", async () => {
    const user = userEvent.setup();
    render(await renderProfile("edward"));

    await user.click(screen.getByRole("button", { name: /editar perfil/i }));

    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue("Edward");
    expect(screen.getByLabelText(/apellidos/i)).toHaveValue("Elric");
  });

  it("renders your own profile, with the edit control, when the username matches you", async () => {
    render(await renderProfile("edward"));

    expect(
      screen.getByRole("heading", { name: "Edward Elric" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /editar secciones/i }),
    ).toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("takes the member-since line on your own profile from the API", async () => {
    render(await renderProfile("edward"));

    expect(
      screen.getByTestId("profile-member-since").closest("p"),
    ).toHaveTextContent(/en el grupo desde marzo de 2022/i);
  });

  it("renders another member's profile, without the edit control", async () => {
    render(await renderProfile("gon"));

    expect(
      screen.getByRole("heading", { name: "Gon Freecss" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /editar secciones/i }),
    ).not.toBeInTheDocument();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("takes another member's member-since line from the API", async () => {
    render(await renderProfile("gon"));

    expect(
      screen.getByTestId("profile-member-since").closest("p"),
    ).toHaveTextContent(/en el grupo desde septiembre de 2023/i);
  });

  it("calls notFound for a username that is not in the group", async () => {
    await renderProfile("no-existe");

    expect(notFound).toHaveBeenCalled();
  });

  it("shows a recoverable error state when the roster fails to load, instead of a false 404", async () => {
    // A roster fetch failing (network hiccup, 500) says nothing about
    // whether "gon" is actually in the group — treating it as notFound()
    // would misreport a real member as missing.
    apiFetch.mockRejectedValue(new ApiError("boom", 500, "internal_error"));

    render(await renderProfile("gon"));

    expect(notFound).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });

  it("shows the session-expired state for a 401, instead of a false 404", async () => {
    apiFetch.mockRejectedValue(new ApiError("no token", 401, "invalid_token"));

    render(await renderProfile("gon"));

    expect(notFound).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/entrar?redirect_url=%2Fmiembros%2Fgon");
  });
});
