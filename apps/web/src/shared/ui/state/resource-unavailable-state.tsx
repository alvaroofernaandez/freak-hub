import Link from "next/link";
import type { StateSize } from "./state-surface";
import { StateSurface } from "./state-surface";

interface ResourceUnavailableStateProps {
  size: Extract<StateSize, "page" | "section">;
  title: string;
  description?: string;
  backHref: string;
  backLabel: string;
}

const LINK_CLASSES =
  "inline-flex min-h-11 items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90";

/**
 * A specific resource does not exist — a member not in the group, an
 * unknown category, a work that was never added (docs/states.md). Unlike
 * the global unmatched-route page, this keeps the surrounding module shell:
 * the reader followed a link or typed a URL for something real, they just
 * picked (or were sent) the wrong specific thing.
 */
export function ResourceUnavailableState({
  size,
  title,
  description,
  backHref,
  backLabel,
}: ResourceUnavailableStateProps) {
  return (
    <StateSurface
      size={size}
      title={title}
      description={description}
      primaryAction={
        <Link href={backHref} className={LINK_CLASSES}>
          {backLabel}
        </Link>
      }
    />
  );
}
