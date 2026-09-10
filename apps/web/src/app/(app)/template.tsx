import type { ReactNode } from "react";

/**
 * Next.js remounts `template.tsx` on every navigation inside this segment,
 * unlike `layout.tsx`, which stays mounted. That makes it the one place a CSS
 * `@keyframes` entrance replays on client-side route changes, not only on
 * first paint. Motion's `initial` cannot do this job: it renders its
 * server-side value on first paint (ADR-0012), which would hide the very
 * first route this app shows.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  return <div className="animate-route-in">{children}</div>;
}
