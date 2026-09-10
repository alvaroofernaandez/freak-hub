import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type InlineMessageTone = "error" | "warning" | "success" | "info";

interface InlineMessageProps {
  tone: InlineMessageTone;
  children: ReactNode;
  /** Only meaningful for `tone="error"`: whether this message appeared as
   * the direct result of something the person just did (a submit), which
   * warrants interrupting (`role="alert"`). An error that was already there
   * when the region mounted uses `role="status"`, same as every other tone —
   * there is no user action for it to interrupt (ADR-0014 §5, no toast
   * channel: every message needs a natural resting place instead). */
  afterUserAction?: boolean;
  /** Overrides the default `text-sm` — a compact surface (the invite
   * popover) uses `text-xs` to match its own density. */
  className?: string;
}

const TONE_CLASSES: Record<InlineMessageTone, string> = {
  error: "text-danger",
  warning: "text-warning",
  success: "text-success",
  info: "text-ink-muted",
};

export function InlineMessage({
  tone,
  children,
  afterUserAction,
  className,
}: InlineMessageProps) {
  const role = tone === "error" && afterUserAction ? "alert" : "status";

  return (
    <p role={role} className={cn("text-sm", TONE_CLASSES[tone], className)}>
      {children}
    </p>
  );
}
