"use client";

import type { NormalizedAppError } from "@/shared/errors/types";
import { RetryButton } from "./retry-button";
import type { StateSize } from "./state-surface";
import { StateSurface } from "./state-surface";
import { SupportReference } from "./support-reference";

interface ErrorStateProps {
  error: NormalizedAppError;
  size: StateSize;
  /** Overrides the default `router.refresh()` retry, for a section that
   * needs to re-fetch its own data specifically. */
  onRetry?: () => void | Promise<void>;
}

/**
 * A recoverable failure, built straight from a `NormalizedAppError`
 * (docs/states.md): title and description already resolved by
 * `normalizeError`, a `RetryButton` only when the recovery says so, and a
 * `SupportReference` only when there is a correlation id to hand support.
 */
export function ErrorState({ error, size, onRetry }: ErrorStateProps) {
  return (
    <StateSurface
      size={size}
      title={error.copy.title}
      description={error.copy.description}
      primaryAction={
        error.recovery.kind === "retry" ? (
          <RetryButton onRetry={onRetry} retryAfterSeconds={error.retryAfter} />
        ) : undefined
      }
      supportReference={
        error.correlationId ? (
          <SupportReference id={error.correlationId} />
        ) : undefined
      }
    />
  );
}
