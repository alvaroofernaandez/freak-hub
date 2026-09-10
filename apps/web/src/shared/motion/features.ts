import { domMax } from "motion/react";

/**
 * `domMax` over `domAnimation`: the platform needs layout/layoutId
 * animations (the profile tab indicator, the works grid reflow) and
 * dnd-kit's drag lift, which only `domMax` includes. Loaded asynchronously
 * by `MotionProvider` after hydration (ADR-0012), so this file's only job is
 * to be the lazy-loadable module `LazyMotion` imports.
 */
export default domMax;
