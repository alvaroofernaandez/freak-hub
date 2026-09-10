"use client";

import { useState } from "react";
import { Check, Copy } from "reicon-react";

interface SupportReferenceProps {
  /** A correlation id (`ApiProblem.correlationId`) or a Next.js error
   * `digest` — always opaque, never anything that leaks internals. */
  id: string;
  label?: string;
}

/**
 * The technical reference a person hands support: opaque, monospaced, with
 * a copy button whose result is announced for assistive tech
 * (docs/states.md). Never the primary action of a state — always the last,
 * quiet line.
 */
export function SupportReference({
  id,
  label = "Referencia",
}: SupportReferenceProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context); the id
      // stays visible on screen to copy by hand either way.
    }
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span className="font-mono">
        {label}: {id}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex size-6 items-center justify-center rounded text-ink-muted transition-colors hover:text-ink"
      >
        {copied ? (
          <Check size={14} aria-hidden="true" />
        ) : (
          <Copy size={14} aria-hidden="true" />
        )}
        <span className="sr-only">Copiar referencia</span>
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Referencia copiada" : ""}
      </span>
    </p>
  );
}
