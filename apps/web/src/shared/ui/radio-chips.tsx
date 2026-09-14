"use client";

import * as RadixRadioGroup from "@radix-ui/react-radio-group";
import { useId } from "react";
import type { IconComponent } from "reicon-react";
import { cn } from "@/shared/lib/cn";

export type RadioChipOption<T extends string> = {
  value: T;
  label: string;
  Icon?: IconComponent;
};

type RadioChipsProps<T extends string> = {
  /** What is being chosen, in the words a person would use: "Estado". */
  label: string;
  value: T;
  onValueChange: (value: T) => void;
  options: RadioChipOption<T>[];
  /** Options that exist but cannot be picked right now. They render
   * disabled rather than disappearing: the set of choices is information,
   * and a list that silently shrinks teaches nothing. Whoever renders this
   * owes the reason in text, via `describedBy`. */
  unavailable?: readonly T[];
  /** The whole group, while a write is in flight. */
  disabled?: boolean;
  /** id of the element that explains the choice (a `FormField` helper). */
  describedBy?: string;
};

/**
 * Pick exactly one of a short list, as a row of chips.
 *
 * Built on `@radix-ui/react-radio-group` rather than on the toggle buttons
 * `category-works-browser.tsx` uses for its filters, because the two are not
 * the same control: a filter row is several independent toggles, this is one
 * value with several candidates. Radix gives it the right role, the roving
 * tab stop (one tab into the group, arrows within it) and disabled-item
 * handling, none of which a row of `aria-pressed` buttons has.
 *
 * No native radio input: the browser paints its box with the operating
 * system's colours, which on this dark surface belongs to nothing around it
 * (docs/design.md). `app/native-controls.test.ts` guards that by scanning the
 * source for the literal attribute, comments included — which is why this
 * paragraph describes the banned control instead of spelling it.
 *
 * The selected chip is filled with the accent, but selection never rests on
 * colour alone — the `aria-checked` the primitive sets is what a screen
 * reader reads, and the icon each option carries is what distinguishes it on
 * a category screen where colour is already spent (docs/design.md).
 */
export function RadioChips<T extends string>({
  label,
  value,
  onValueChange,
  options,
  unavailable,
  disabled,
  describedBy,
}: RadioChipsProps<T>) {
  const labelId = useId();

  return (
    <>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <RadixRadioGroup.Root
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        value={value}
        onValueChange={(next) => onValueChange(next as T)}
        disabled={disabled}
        orientation="horizontal"
        loop={false}
        className="flex flex-wrap gap-2"
      >
        {options.map(({ value: optionValue, label: optionLabel, Icon }) => {
          const isSelected = optionValue === value;
          const isUnavailable = unavailable?.includes(optionValue) ?? false;

          return (
            <RadixRadioGroup.Item
              key={optionValue}
              value={optionValue}
              disabled={disabled || isUnavailable}
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 font-sans text-xs font-semibold",
                "transition-colors duration-150",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                isSelected
                  ? "border-accent bg-accent text-accent-ink"
                  : "border-border text-ink-muted hover:border-ink-muted hover:text-ink",
                "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:text-ink-muted",
              )}
            >
              {Icon ? <Icon size={14} aria-hidden="true" /> : null}
              {optionLabel}
            </RadixRadioGroup.Item>
          );
        })}
      </RadixRadioGroup.Root>
    </>
  );
}
