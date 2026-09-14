import type { Metadata } from "next";
import { ResourceUnavailableState } from "@/shared/ui/state/resource-unavailable-state";

export const metadata: Metadata = { title: "Obra no disponible" };

/** Reached when `page.tsx` gets `library_entry_not_found` from
 * `GET /v1/library/{id}`. That one code covers both "no entry with that id"
 * and "it is not yours", on purpose: a 403 for somebody else's entry would
 * confirm it exists, and whose library holds what is nobody else's business
 * (packages/contracts/openapi.yaml, `LibraryEntryNotFound`). Every other
 * failure stays on the page as a state — a server that is down is not a work
 * that does not exist. */
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
