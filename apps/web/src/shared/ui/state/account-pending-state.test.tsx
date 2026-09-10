import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { AccountPendingState } = await import("./account-pending-state");

describe("AccountPendingState", () => {
  it("explains the account is still being provisioned and offers to retry", () => {
    render(<AccountPendingState size="page" />);

    expect(
      screen.getByRole("heading", { name: /todavía no está lista/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();
  });
});
