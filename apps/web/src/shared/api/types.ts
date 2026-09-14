/**
 * Re-exports of the API contract.
 *
 * The shapes come from packages/contracts/openapi.yaml, so a change to the
 * contract that is not reflected here (or in the API) fails the typecheck
 * instead of turning into a runtime surprise.
 */
import type { components } from "@freak-hub/contracts";

export type Member = components["schemas"]["Member"];
export type MemberPage = components["schemas"]["MemberPage"];
export type Invitation = components["schemas"]["Invitation"];
export type InvitationPage = components["schemas"]["InvitationPage"];
export type ApiErrorBody = components["schemas"]["Error"];
export type InvitationStatus = Invitation["status"];
export type InvitationInviter = components["schemas"]["InvitationInviter"];
export type GroupInvitation = components["schemas"]["GroupInvitation"];
export type GroupInvitationPage = components["schemas"]["GroupInvitationPage"];
export type Work = components["schemas"]["Work"];
export type WorkPage = components["schemas"]["WorkPage"];
export type WorkCategory = components["schemas"]["WorkCategory"];
export type WorkSource = components["schemas"]["WorkSource"];
export type LibraryEntry = components["schemas"]["LibraryEntry"];
export type LibraryEntryPage = components["schemas"]["LibraryEntryPage"];
export type LibraryEntryStatus = components["schemas"]["LibraryEntryStatus"];
export type CreateWorkRequest = components["schemas"]["CreateWorkRequest"];
export type CreateLibraryEntryRequest =
  components["schemas"]["CreateLibraryEntryRequest"];
export type UpdateLibraryEntryRequest =
  components["schemas"]["UpdateLibraryEntryRequest"];
