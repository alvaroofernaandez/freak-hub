"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { AnimatePresence, m } from "motion/react";
import { useId, useState } from "react";
import { Check, ChevronDown } from "reicon-react";
import { cn } from "@/shared/lib/cn";
import { DURATION, EXIT_RATIO, variants } from "@/shared/motion/tokens";

const ENTER_TRANSITION = { duration: DURATION.fast };
const EXIT_TRANSITION = { duration: DURATION.fast * EXIT_RATIO };

type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  label: string;
  disabled?: boolean;
};

/**
 * A select that belongs to this app. The native control renders its list with
 * the operating system's own colours, which on a dark surface arrives as a
 * bright white-and-blue panel that belongs to nothing around it.
 */
export function Select({
  value,
  onValueChange,
  options,
  label,
  disabled,
}: SelectProps) {
  const labelId = useId();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <RadixSelect.Root
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <RadixSelect.Trigger
          aria-labelledby={labelId}
          className={cn(
            "inline-flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm text-ink",
            "transition-colors duration-150 hover:border-ink-muted",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          {/* Controlling `open` for the exit animation means Radix's Content
           * (and the Items that teach `Value` their label) may never have
           * mounted yet when this renders, so the label is passed in
           * explicitly instead of left for Radix to look up. */}
          <RadixSelect.Value>
            {options.find((option) => option.value === value)?.label}
          </RadixSelect.Value>
          <RadixSelect.Icon>
            <ChevronDown size={14} aria-hidden="true" />
          </RadixSelect.Icon>
        </RadixSelect.Trigger>

        <AnimatePresence>
          {isOpen ? (
            <RadixSelect.Portal forceMount>
              <RadixSelect.Content
                asChild
                forceMount
                position="popper"
                sideOffset={6}
              >
                <m.div
                  className="z-50 origin-[var(--radix-select-content-transform-origin)] overflow-hidden rounded-xl border border-border bg-surface p-1.5 shadow-2xl"
                  initial={variants.popover.hidden}
                  animate={{
                    ...variants.popover.shown,
                    transition: ENTER_TRANSITION,
                  }}
                  exit={{
                    ...variants.popover.exit,
                    transition: EXIT_TRANSITION,
                  }}
                >
                  <RadixSelect.Viewport>
                    {options.map((option) => (
                      <RadixSelect.Item
                        key={option.value}
                        value={option.value}
                        className={cn(
                          "flex cursor-pointer items-center justify-between gap-6 rounded-lg px-3 py-2 text-sm text-ink-muted outline-none",
                          "data-[highlighted]:bg-surface-raised data-[highlighted]:text-ink",
                          "data-[state=checked]:text-ink",
                        )}
                      >
                        <RadixSelect.ItemText>
                          {option.label}
                        </RadixSelect.ItemText>
                        <RadixSelect.ItemIndicator>
                          <Check size={14} aria-hidden="true" />
                        </RadixSelect.ItemIndicator>
                      </RadixSelect.Item>
                    ))}
                  </RadixSelect.Viewport>
                </m.div>
              </RadixSelect.Content>
            </RadixSelect.Portal>
          ) : null}
        </AnimatePresence>
      </RadixSelect.Root>
    </>
  );
}
