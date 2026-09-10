import Link from "next/link";
import type { StateSize } from "./state-surface";
import { StateSurface } from "./state-surface";

interface SessionExpiredStateProps {
  size: StateSize;
  /** The path to return to after signing in again. */
  redirectPath: string;
}

const LINK_CLASSES =
  "inline-flex min-h-11 items-center rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90";

/** A 401 (missing or invalid token): the session is gone, not the resource. */
export function SessionExpiredState({
  size,
  redirectPath,
}: SessionExpiredStateProps) {
  return (
    <StateSurface
      size={size}
      title="Tu sesión ha caducado"
      description="Inicia sesión de nuevo para continuar."
      primaryAction={
        <Link
          href={`/entrar?redirect_url=${encodeURIComponent(redirectPath)}`}
          className={LINK_CLASSES}
        >
          Iniciar sesión
        </Link>
      }
    />
  );
}
