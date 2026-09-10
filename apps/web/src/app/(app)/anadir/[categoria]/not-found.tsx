import type { Metadata } from "next";
import { ResourceUnavailableState } from "@/shared/ui/state/resource-unavailable-state";

export const metadata: Metadata = { title: "Categoría no encontrada" };

/** Catches `notFound()` from both `page.tsx` (catalog search) and
 * `manual/page.tsx` (manual entry) — it is the nearest `not-found.tsx`
 * above both, and Next.js resolves a `notFound()` call to the closest
 * ancestor boundary. */
export default function NotFound() {
  return (
    <ResourceUnavailableState
      size="page"
      title="Esta categoría no existe"
      backHref="/biblioteca"
      backLabel="Volver a la biblioteca"
    />
  );
}
