"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { DURATION, EASE_OUT_QUINT } from "./tokens";

const loadFeatures = () => import("./features").then((res) => res.default);

/**
 * Wraps the app once, at the root (ADR-0012). `strict` so a stray `motion.*`
 * import (the full, always-loaded component) fails loudly instead of quietly
 * paying for the bundle a `m.*` import would have avoided.
 *
 * `reducedMotion="user"` reads the OS setting once, here, instead of a
 * `motion-reduce:` utility per component: transforms, scale and layout
 * animations are skipped system-wide, opacity fades still run.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: DURATION.base, ease: EASE_OUT_QUINT }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
