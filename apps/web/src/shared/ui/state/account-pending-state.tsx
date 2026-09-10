"use client";

import { RetryButton } from "./retry-button";
import type { StateSize } from "./state-surface";
import { StateSurface } from "./state-surface";

interface AccountPendingStateProps {
  size: StateSize;
}

/**
 * A valid session with no `members` row yet (404 `unknown_identity` — the
 * `user.created` webhook has not landed). Distinct from `not_found`: the
 * identity is real, it is just not ready yet, so the only sane action is to
 * wait and retry, not to sign in again or treat it as a missing resource.
 */
export function AccountPendingState({ size }: AccountPendingStateProps) {
  return (
    <StateSurface
      size={size}
      title="Tu cuenta todavía no está lista"
      description="Estamos terminando de preparar tu perfil. Vuelve a intentarlo en un momento."
      primaryAction={<RetryButton />}
    />
  );
}
