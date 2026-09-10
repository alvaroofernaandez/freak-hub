import type { Metadata } from "next";
import { ResourceUnavailableState } from "@/shared/ui/state/resource-unavailable-state";

export const metadata: Metadata = { title: "Página no encontrada" };

/**
 * The global boundary for a URL that matches no route at all — outside the
 * authenticated app shell (`app/(app)/layout.tsx`) on purpose: there is no
 * module context to keep, since nothing here identified which module was
 * meant (ADR-0014 §3). Compare `app/(app)/not-found.tsx` and the
 * segment-specific ones, which all keep the shell because they *do* know
 * which module the missing thing belongs to.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <ResourceUnavailableState
        size="page"
        title="Esta dirección no existe"
        description="Comprueba la dirección o vuelve a un lugar seguro."
        backHref="/inicio"
        backLabel="Ir a inicio"
      />
    </div>
  );
}
