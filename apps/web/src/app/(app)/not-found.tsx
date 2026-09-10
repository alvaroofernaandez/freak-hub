import type { Metadata } from "next";
import { ResourceUnavailableState } from "@/shared/ui/state/resource-unavailable-state";

export const metadata: Metadata = { title: "No encontrado" };

/**
 * The generic boundary for a `notFound()` call inside the authenticated
 * shell with no more specific segment `not-found.tsx` to catch it — keeps
 * the navbar and category stripe, unlike the global `app/not-found.tsx`.
 * Prefer a segment-specific `not-found.tsx` (miembros/[username],
 * biblioteca/[categoria], anadir/[categoria], obras/[id]) whenever the
 * missing thing has a natural, more specific way back.
 */
export default function NotFound() {
  return (
    <ResourceUnavailableState
      size="page"
      title="No se ha encontrado"
      description="No hemos encontrado lo que buscabas."
      backHref="/inicio"
      backLabel="Ir a inicio"
    />
  );
}
