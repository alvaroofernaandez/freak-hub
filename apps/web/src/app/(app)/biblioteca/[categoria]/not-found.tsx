import type { Metadata } from "next";
import { ResourceUnavailableState } from "@/shared/ui/state/resource-unavailable-state";

export const metadata: Metadata = { title: "Categoría no encontrada" };

/** `isCategoryId` in `page.tsx` calls `notFound()` for a `categoria` segment
 * that is not one of the six known categories. */
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
