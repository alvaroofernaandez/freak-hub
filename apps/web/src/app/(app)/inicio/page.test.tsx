import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Member } from "@/shared/api/types";

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

const { default: HomePage } = await import("./page");
const { ApiError } = await import("@/shared/lib/api-client");

const PROFILE: Member = {
  id: "1",
  clerk_user_id: "user_1",
  username: "alvaro",
  display_name: "Álvaro",
  created_at: "2026-01-04T00:00:00.000Z",
};

describe("HomePage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    getToken.mockReset();
    getToken.mockResolvedValue("session-token");
    currentUser.mockReset();
    currentUser.mockResolvedValue({ username: "alvaro", fullName: "Álvaro" });
  });

  it("shows the verified session once the API answers", async () => {
    apiFetch.mockResolvedValue(PROFILE);

    render(await HomePage());

    expect(screen.getByText(/sesión verificada/i)).toBeInTheDocument();
    expect(screen.getByText("@alvaro")).toBeInTheDocument();
  });

  it("shows the session-expired state for a 401, with a sign-in link", async () => {
    apiFetch.mockRejectedValue(new ApiError("no token", 401, "invalid_token"));

    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: /sesión ha caducado/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/entrar?redirect_url=%2Finicio");
  });

  it("shows the account-pending state for a 404 unknown_identity", async () => {
    apiFetch.mockRejectedValue(
      new ApiError("not ready", 404, "unknown_identity"),
    );

    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: /todavía no está lista/i }),
    ).toBeInTheDocument();
  });

  it("shows a recoverable error state with retry for anything else", async () => {
    apiFetch.mockRejectedValue(new ApiError("boom", 500, "internal_error"));

    render(await HomePage());

    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });
});
