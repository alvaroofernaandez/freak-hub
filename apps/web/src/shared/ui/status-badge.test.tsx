import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge";

const VARIANTS = [
  { status: "wishlist", icon: "☆", label: "Wishlist" },
  { status: "pending", icon: "○", label: "Pendiente" },
  { status: "in_progress", icon: "◐", label: "En curso" },
  { status: "completed", icon: "●", label: "Terminado" },
  { status: "dropped", icon: "✕", label: "Abandonado" },
  { status: "on_hold", icon: "❚❚", label: "En pausa" },
] as const;

describe("StatusBadge", () => {
  it.each(VARIANTS)("renders the icon and label for status $status", ({
    status,
    icon,
    label,
  }) => {
    render(<StatusBadge status={status} />);

    expect(screen.getByTestId("status-badge-icon")).toHaveTextContent(icon);
    expect(screen.getByText(label)).toBeInTheDocument();
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
