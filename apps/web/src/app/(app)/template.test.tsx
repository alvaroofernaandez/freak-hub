import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AppTemplate from "./template";

/**
 * Next.js remounts `template.tsx` on every navigation within the segment
 * (unlike `layout.tsx`, which persists), so a CSS `@keyframes` here is the
 * one place in the tree that reliably replays on client-side route changes,
 * not just on first paint.
 */
describe("AppTemplate", () => {
  it("wraps route content in the route-in entrance animation", () => {
    render(
      <AppTemplate>
        <p>Contenido de la ruta</p>
      </AppTemplate>,
    );

    const content = screen.getByText("Contenido de la ruta");
    expect(content.parentElement).toHaveClass("animate-route-in");
  });
});
