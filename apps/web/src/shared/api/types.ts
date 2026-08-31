/**
 * Re-exports of the API contract.
 *
 * The shapes come from packages/contracts/openapi.yaml, so a change to the
 * contract that is not reflected here (or in the API) fails the typecheck
 * instead of turning into a runtime surprise.
 */
import type { components } from "@freak-hub/contracts";

export type Member = components["schemas"]["Member"];
export type Invitation = components["schemas"]["Invitation"];
export type ApiErrorBody = components["schemas"]["Error"];
export type InvitationStatus = Invitation["status"];
