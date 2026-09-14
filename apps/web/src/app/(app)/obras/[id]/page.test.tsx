import { beforeEach, describe, expect, it, vi } from "vitest";

const notFound = vi.fn();
vi.mock("next/navigation", () => ({ notFound: () => notFound() }));

const { default: WorkPage } = await import("./page");

describe("WorkPage", () => {
  // `notFound` lives at module scope and its call history outlives a single
  // test, so without this the suite passes or fails depending on the order it
  // runs in (`--sequence.shuffle`): a `not.toHaveBeenCalled()` sees the call
  // another test made.
  beforeEach(() => {
    notFound.mockClear();
  });

  it("calls notFound for any id, since there is no library endpoint yet", async () => {
    await WorkPage({ params: Promise.resolve({ id: "does-not-exist" }) });

    expect(notFound).toHaveBeenCalled();
  });

  it("calls notFound even for an id that used to be a seeded work", async () => {
    await WorkPage({ params: Promise.resolve({ id: "anime-fma" }) });

    expect(notFound).toHaveBeenCalled();
  });
});
