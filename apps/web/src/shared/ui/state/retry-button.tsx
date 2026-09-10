"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/shared/lib/cn";
import { PendingLabel } from "@/shared/ui/pending-label";

interface RetryButtonProps {
  label?: string;
  pendingLabel?: string;
  /** Defaults to `router.refresh()` (re-runs the failed server request in
   * place). Pass an async `onRetry` for anything that needs its own retry
   * logic — the pending state tracks it either way. */
  onRetry?: () => void | Promise<void>;
  className?: string;
  /** Seconds to wait before retrying is allowed, from the Problem's
   * `retry_after` (`NormalizedAppError.retryAfter`, ADR-0014 §1) — a 429 or
   * a 503 the API asked the client to back off from. The button stays
   * disabled and explains why until it elapses, then enables itself. */
  retryAfterSeconds?: number;
}

/**
 * The one retry affordance every recoverable state uses (docs/states.md):
 * a real `<button>`, disabled and cross-fading to its pending label while
 * the retry is in flight, at a stable width (`PendingLabel`). When the API
 * asked for a delay (`retryAfterSeconds`), it starts disabled and explains
 * why once — not a ticking countdown that re-announces itself every second.
 */
export function RetryButton({
  label = "Reintentar",
  pendingLabel = "Reintentando…",
  onRetry,
  className,
  retryAfterSeconds,
}: RetryButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [waiting, setWaiting] = useState(
    typeof retryAfterSeconds === "number" && retryAfterSeconds > 0,
  );

  useEffect(() => {
    if (!waiting || typeof retryAfterSeconds !== "number") {
      return;
    }
    const timer = window.setTimeout(() => {
      setWaiting(false);
    }, retryAfterSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [waiting, retryAfterSeconds]);

  function handleClick() {
    startTransition(async () => {
      await (onRetry ? onRetry() : router.refresh());
    });
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending || waiting}
        className={cn(
          "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <PendingLabel
          pending={pending}
          idleLabel={label}
          pendingLabel={pendingLabel}
        />
      </button>
      {waiting ? (
        <output aria-live="polite" className="text-xs text-ink-muted">
          Podrás reintentarlo en unos segundos.
        </output>
      ) : null}
    </div>
  );
}
