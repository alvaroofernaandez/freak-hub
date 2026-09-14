"use client";

import { useId } from "react";
import { cn } from "@/shared/lib/cn";
import { useTheme } from "@/shared/lib/use-theme";

/**
 * The theme switch (docs/screens.md#ajustes). A `role="switch"` button rather
 * than a native checkbox, for the same reason as every other control here: a
 * native box paints itself with the operating system's colours
 * (`native-controls.test.ts`).
 *
 * It is a switch and not a pair of radios because there are two states and no
 * third: "system" would be a third, and this app decides its own default
 * (dark) on purpose.
 *
 * Motion: only the knob moves, 120ms, the same budget `Checkbox` already
 * argues for by frequency. The colour swap of the page itself is deliberately
 * instant — animating it would mean dozens of `transition-colors` firing at
 * once, which reads as lag, not as polish.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const labelId = useId();
  const descriptionId = useId();

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <p id={labelId} className="text-sm font-medium text-ink">
          Tema claro
        </p>
        <p id={descriptionId} className="max-w-[46ch] text-sm text-ink-muted">
          Freak Hub arranca en oscuro. Enciende esto para la versión clara; se
          recuerda en este navegador.
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isLight}
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
        onClick={toggleTheme}
        className="flex h-11 w-14 shrink-0 items-center justify-center rounded-lg"
      >
        <span
          className={cn(
            "flex h-7 w-12 items-center rounded-full border px-1 transition-colors duration-150",
            isLight ? "border-accent bg-accent" : "border-border bg-surface",
          )}
        >
          <span
            className={cn(
              "h-5 w-5 rounded-full transition-transform duration-[120ms] ease-out-quint motion-reduce:transition-none",
              isLight
                ? "translate-x-5 bg-accent-ink"
                : "translate-x-0 bg-ink-muted",
            )}
          />
        </span>
      </button>
    </div>
  );
}
