import { describe, expect, it, vi } from "vitest";

const notFound = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const { default: WorkPage } = await import("./page");

describe("WorkPage", () => {
  it("calls notFound for any id, since there is no library endpoint yet", async () => {
    notFound.mockClear();
    await WorkPage({ params: Promise.resolve({ id: "does-not-exist" }) });

    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound even for an id that used to be a seeded work", async () => {
    notFound.mockClear();
    await WorkPage({ params: Promise.resolve({ id: "anime-fma" }) });

    expect(notFound).toHaveBeenCalled();
  });
});
