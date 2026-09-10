"use client";

// Adapted from Cult UI's `animated-number.tsx`
// (github.com/nolly-studio/cult-ui, apps/www/registry/default/ui/animated-number.tsx).
// Changed from the original:
//   - the spring is critically damped (`bounce: 0`) instead of the
//     original's mass/stiffness/damping combo, which is underdamped and
//     visibly overshoots past the target before settling;
//   - the spring is seeded at `value` on mount, so the first paint shows the
//     real number instead of counting up from 0;
//   - `prefers-reduced-motion` renders the plain formatted value with no
//     spring at all, instead of always animating;
//   - the rolling figure is `aria-hidden`, with the true value exposed to
//     assistive tech through a separate `sr-only` node, instead of reading
//     out every intermediate frame;
//   - default formatting uses the `es-ES` locale (project language), not
//     the browser's;
//   - renders with `m.span` (this project's strict `LazyMotion`) instead of
//     `motion.span`.

import {
  m,
  useReducedMotionConfig,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect } from "react";
import { cn } from "@/shared/lib/cn";

type AnimatedNumberProps = {
  value: number;
  /** Defaults to the `es-ES` locale grouping (project language). */
  format?: (value: number) => string;
  className?: string;
};

const DEFAULT_FORMAT = (value: number) => value.toLocaleString("es-ES");

/**
 * A figure that rolls to its new value instead of snapping (ADR-0013). Used
 * wherever a count changes while the user is looking at it: category counts,
 * profile stats, home dashboard numbers.
 */
export function AnimatedNumber({
  value,
  format = DEFAULT_FORMAT,
  className,
}: AnimatedNumberProps) {
  // `useReducedMotionConfig` (unlike `useReducedMotion`) also honors the
  // `<MotionConfig reducedMotion>` context, not only the OS-level media
  // query — matching how the app's own `MotionProvider` sets
  // `reducedMotion="user"` (docs/design.md, ADR-0012).
  const prefersReducedMotion = useReducedMotionConfig();
  // Seeded at `value`: the spring's initial state already equals the target,
  // so first paint shows the real number, never a count-up from zero.
  const spring = useSpring(value, {
    visualDuration: 0.4,
    bounce: 0,
  });
  const display = useTransform(spring, (current) =>
    format(Math.round(current)),
  );

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  if (prefersReducedMotion) {
    return (
      <span className={cn("tabular-nums", className)}>{format(value)}</span>
    );
  }

  return (
    <span className={className}>
      <m.span aria-hidden="true" className="tabular-nums">
        {display}
      </m.span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
