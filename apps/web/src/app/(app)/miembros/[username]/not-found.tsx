import type { Metadata } from "next";
import { ResourceUnavailableState } from "@/shared/ui/state/resource-unavailable-state";

export const metadata: Metadata = { title: "Miembro no encontrado" };

/** `findMember` in `page.tsx` calls `notFound()` when the username is not in
 * the group's roster. */
export default function NotFound() {
  return (
    <ResourceUnavailableState
      size="page"
      title="Este miembro no está en el grupo"
      backHref="/miembros"
      backLabel="Volver al grupo"
    />
  );
}
