import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { STATUS_ORDER, StatusBadge } from "./status-badge";

const VARIANTS = [
  { status: "wishlist", label: "Wishlist" },
  { status: "pending", label: "Pendiente" },
  { status: "in_progress", label: "En curso" },
  { status: "completed", label: "Terminado" },
  { status: "dropped", label: "Abandonado" },
  { status: "on_hold", label: "En pausa" },
] as const;

describe("StatusBadge", () => {
  it("does not pop the icon on the first render", () => {
    render(<StatusBadge status="pending" />);

    expect(screen.getByTestId("status-badge-icon")).not.toHaveAttribute(
      "data-pop",
    );
  });

  it("pops the icon when the status actually changes", () => {
    const { rerender } = render(<StatusBadge status="pending" />);

    rerender(<StatusBadge status="completed" />);

    expect(screen.getByTestId("status-badge-icon")).toHaveAttribute("data-pop");
  });

  it.each(VARIANTS)("renders the icon and label for status $status", ({
    status,
    label,
  }) => {
    render(<StatusBadge status={status} />);

    // A real icon, not a typographic glyph borrowed from the body font.
    expect(
      screen.getByTestId("status-badge-icon").querySelector("svg"),
    ).not.toBeNull();
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("gives each status its own icon, so none of them read alike", () => {
    const shapes = new Set<string>();

    for (const { status } of VARIANTS) {
      const { unmount, getByTestId } = render(<StatusBadge status={status} />);
      shapes.add(getByTestId("status-badge-icon").innerHTML);
      unmount();
    }

    expect(shapes.size).toBe(VARIANTS.length);
  });

  it("exposes the icon component through STATUS_ORDER, for filters to render", () => {
    for (const entry of STATUS_ORDER) {
      expect(typeof entry.Icon).not.toBe("string");
      expect(entry.Icon).toBeDefined();
    }
  });

  it.each(
    VARIANTS,
  )("hides the icon from assistive technology for status $status", ({
    status,
  }) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByTestId("status-badge-icon")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("gives every variant the exact same className, regardless of status", () => {
    const classNames = VARIANTS.map(({ status }) => {
      const { unmount, getByTestId } = render(<StatusBadge status={status} />);
      const className = getByTestId("status-badge").className;
      unmount();
      return className;
    });

    for (const className of classNames) {
      expect(className).toBe(classNames[0]);
    }
  });
});

describe("STATUS_ORDER", () => {
  it("lists all six statuses with their icon and label", () => {
    expect(STATUS_ORDER.map((entry) => entry.status)).toEqual(
      VARIANTS.map((v) => v.status),
    );
    for (const [index, entry] of STATUS_ORDER.entries()) {
      expect(entry.label).toBe(VARIANTS[index]?.label);
      expect(entry.Icon).toBeDefined();
    }
  });
});
