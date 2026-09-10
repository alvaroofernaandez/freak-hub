"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { normalizeError } from "@/shared/errors/normalize-error";
import { reportError } from "@/shared/errors/report-error";
import { ErrorState } from "@/shared/ui/state/error-state";

interface AppErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * The module boundary: something inside the authenticated shell threw an
 * uncaught exception. Keeps the shell (`app/(app)/layout.tsx` stays
 * mounted, unlike `global-error.tsx`) and shows normalized copy — never
 * `error.message`, which can carry a raw JS exception or a stack fragment.
 * `error.digest` (Next's own opaque reference for a server-side error) is
 * the support reference, not `error.message` either.
 *
 * "Reintentar" runs `reset()` (clears the boundary) and `router.refresh()`
 * together: `reset()` alone re-renders the boundary but does not re-run the
 * failed server request.
 */
export default function AppError({ error, reset }: AppErrorProps) {
  const router = useRouter();
  const normalized = useMemo(
    () => ({
      ...normalizeError(error, {
        resource: "esta sección",
        operation: "load",
        scope: "module",
      }),
      correlationId: error.digest,
    }),
    [error],
  );

  useEffect(() => {
    reportError(normalized, { route: window.location.pathname });
  }, [normalized]);

  return (
    <ErrorState
      error={normalized}
      size="page"
      onRetry={() => {
        reset();
        router.refresh();
      }}
    />
  );
}
