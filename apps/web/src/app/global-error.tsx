"use client";

import { SupportReference } from "@/shared/ui/state/support-reference";
import "./globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

const BUTTON_CLASSES =
  "inline-flex min-h-11 items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90";

/**
 * The last-resort boundary: something failed badly enough to take down the
 * root layout itself, so this replaces `app/layout.tsx` entirely and must
 * define its own `<html>`/`<body>` (Next.js requirement). No `ClerkProvider`,
 * no `MotionProvider`, no fonts beyond the system stack: none of that is
 * trustworthy at this point. `globals.css` is imported directly so the
 * design tokens still apply.
 *
 * No technical detail is ever shown — only the error's `digest`, opaque, as
 * a support reference (ADR-0014 §4).
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="es">
      <body className="flex min-h-dvh items-center justify-center bg-ground px-6 text-ink antialiased">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Algo ha fallado</h1>
            <p className="mx-auto max-w-[65ch] text-pretty text-sm text-ink-muted">
              Vuelve a intentarlo. Si el problema continúa, recarga la página.
            </p>
          </div>
          <button type="button" onClick={reset} className={BUTTON_CLASSES}>
            Recargar
          </button>
          {error.digest ? <SupportReference id={error.digest} /> : null}
        </div>
      </body>
    </html>
  );
}
