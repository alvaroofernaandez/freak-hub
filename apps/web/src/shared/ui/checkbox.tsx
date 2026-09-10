"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { AnimatePresence, m } from "motion/react";
import { useId } from "react";
import { Check } from "reicon-react";
import { cn } from "@/shared/lib/cn";
import { EXIT_RATIO } from "@/shared/motion/tokens";

/**
 * The checkbox is used dozens of times per session (section visibility,
 * filters), so its own motion stays shorter than the shared `fast` token:
 * 120ms in, 90ms out. The frequency gate (ADR-0012) applies to it directly.
 */
const ENTER_TRANSITION = { duration: 0.12 };
const EXIT_TRANSITION = { duration: 0.12 * EXIT_RATIO };

type CheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /** Keep the label for assistive tech, but do not paint it. */
  hideLabel?: boolean;
};

/**
 * A checkbox that looks like the rest of the app. The native control cannot be
 * styled consistently across browsers on a dark surface, so this uses the Radix
 * primitive: same keyboard and screen-reader behaviour, our own paint.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  disabled,
  hideLabel,
}: CheckboxProps) {
  const id = useId();

  return (
    <div className="flex items-center gap-2.5">
      <RadixCheckbox.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-150",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          checked
            ? "border-accent bg-accent text-accent-ink"
            : "border-border bg-surface hover:border-ink-muted",
          disabled && "cursor-not-allowed opacity-50",
        )}
      >
        <AnimatePresence>
          {checked ? (
            <RadixCheckbox.Indicator asChild forceMount>
              <m.span
                className="flex"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1, transition: ENTER_TRANSITION }}
                exit={{ opacity: 0, scale: 0.6, transition: EXIT_TRANSITION }}
              >
                <Check size={12} strokeWidth={2.5} aria-hidden="true" />
              </m.span>
            </RadixCheckbox.Indicator>
          ) : null}
        </AnimatePresence>
      </RadixCheckbox.Root>
      <label
        htmlFor={id}
        className={cn(
          hideLabel ? "sr-only" : "text-sm text-ink",
          !hideLabel && disabled && "opacity-50",
        )}
      >
        {label}
      </label>
    </div>
  );
}
