import type { Metadata } from "next";
import { ResourceUnavailableState } from "@/shared/ui/state/resource-unavailable-state";

export const metadata: Metadata = { title: "Obra no disponible" };

/** `page.tsx` calls `notFound()` unconditionally: there is no library
 * endpoint yet, so no `id` can be confirmed real (docs/roadmap.md). */
export default function NotFound() {
  return (
    <ResourceUnavailableState
      size="page"
      title="Esta obra no está disponible"
      backHref="/biblioteca"
      backLabel="Volver a la biblioteca"
    />
  );
}
