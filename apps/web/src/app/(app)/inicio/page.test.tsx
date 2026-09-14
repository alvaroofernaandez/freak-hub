import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LibraryEntry, Member } from "@/shared/api/types";

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

const IN_PROGRESS: LibraryEntry = {
  id: "entry-hxh",
  work: {
    id: "work-hxh",
    title: "Hunter x Hunter (2011)",
    category: "anime",
    source: "anilist",
    source_id: "11061",
    cover_url: null,
    synopsis: null,
    year: 2011,
    metadata: { episodes: 148 },
    expansion_of: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  status: "in_progress",
  progress: 68,
  rating: null,
  is_favourite: false,
  owned: false,
  note: null,
  started_at: null,
  finished_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

/** Answers each endpoint with its own payload, whatever the call order. */
function respondWith(profile: unknown | Error, rail: unknown | Error): void {
  apiFetch.mockImplementation((path: string) => {
    const payload = path.startsWith("/v1/me") ? profile : rail;
    return payload instanceof Error
      ? Promise.reject(payload)
      : Promise.resolve(payload);
  });
}

const RAIL = { items: [IN_PROGRESS], next_cursor: null };

describe("HomePage", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    getToken.mockReset();
    getToken.mockResolvedValue("session-token");
    currentUser.mockReset();
    currentUser.mockResolvedValue({ username: "alvaro", fullName: "Álvaro" });
  });

  it("asks the API for what is in progress, which is exactly what the rail shows", async () => {
    respondWith(PROFILE, RAIL);

    render(await HomePage());

    expect(apiFetch).toHaveBeenCalledWith(
      "/v1/library?status=in_progress&limit=100",
      { token: "session-token" },
    );
  });

  it("fills the continue rail with the entries it got back", async () => {
    respondWith(PROFILE, RAIL);

    render(await HomePage());

    expect(screen.getByText("Hunter x Hunter (2011)")).toBeInTheDocument();
  });

  it("leaves recommendations and activity empty, because neither has an endpoint", async () => {
    respondWith(PROFILE, RAIL);

    render(await HomePage());

    expect(
      screen.getByText(/sin recomendaciones pendientes/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/sin actividad reciente/i)).toBeInTheDocument();
  });

  it("shows the rail's own failure as a section error, not as an empty rail", async () => {
    respondWith(PROFILE, new ApiError("boom", 503, "service_unavailable"));

    render(await HomePage());

    expect(screen.queryByText(/nada en curso/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
    // The profile block survives it: two independent requests, two outcomes.
    expect(screen.getByText(/sesión verificada/i)).toBeInTheDocument();
  });

  it("keeps the rail when the profile check is the one that fails", async () => {
    respondWith(new ApiError("boom", 500, "internal_error"), RAIL);

    render(await HomePage());

    expect(screen.getByText("Hunter x Hunter (2011)")).toBeInTheDocument();
  });

  it("shows an empty rail, with somewhere to go, when nothing is in progress", async () => {
    respondWith(PROFILE, { items: [], next_cursor: null });

    render(await HomePage());

    expect(screen.getByText(/nada en curso/i)).toBeInTheDocument();
  });

  it("shows the verified session once the API answers", async () => {
    respondWith(PROFILE, RAIL);

    render(await HomePage());

    expect(screen.getByText(/sesión verificada/i)).toBeInTheDocument();
    expect(screen.getByText("@alvaro")).toBeInTheDocument();
  });

  it("shows the session-expired state for a 401, with a sign-in link", async () => {
    const expired = new ApiError("no token", 401, "invalid_token");
    respondWith(expired, expired);

    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: /sesión ha caducado/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/entrar?redirect_url=%2Finicio");
  });

  it("shows the account-pending state for a 404 unknown_identity", async () => {
    const pending = new ApiError("not ready", 404, "unknown_identity");
    respondWith(pending, pending);

    render(await HomePage());

    expect(
      screen.getByRole("heading", { name: /todavía no está lista/i }),
    ).toBeInTheDocument();
  });

  it("shows a recoverable error state with retry for anything else", async () => {
    respondWith(new ApiError("boom", 500, "internal_error"), RAIL);

    render(await HomePage());

    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });
});
