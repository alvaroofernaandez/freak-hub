"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { Camera, Pen } from "reicon-react";
import { Avatar } from "@/features/members/ui/avatar";
import {
  type ProfileFormState,
  updateProfile,
} from "@/features/profile/actions/update-profile";
import { Dialog } from "@/shared/ui/dialog";

type EditProfileDialogProps = {
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl?: string | null;
};

const INITIAL_STATE: ProfileFormState = { status: "idle", message: "" };

const FIELD_CLASS =
  "rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted";

function SaveButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Guardando…" : "Guardar cambios"}
    </button>
  );
}

/**
 * Edits your own profile without showing Clerk. The server action posts to the
 * Go API, which is the only thing that talks to Clerk's Backend API; Clerk's
 * `user.updated` webhook then syncs the `members` row.
 */
export function EditProfileDialog({
  firstName,
  lastName,
  username,
  avatarUrl,
}: EditProfileDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction] = useActionState(updateProfile, INITIAL_STATE);
  const [preview, setPreview] = useState<string | null>(null);
  const titleId = useId();
  const firstNameId = useId();
  const lastNameId = useId();
  const usernameId = useId();
  const photoId = useId();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [state, router]);

  // A local object URL has to be released, or the blob leaks for the session.
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  function close() {
    setIsOpen(false);
    setPreview(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm text-ink-muted transition-colors duration-150 hover:border-accent hover:text-ink"
      >
        <Pen size={15} aria-hidden="true" />
        Editar perfil
      </button>

      <Dialog isOpen={isOpen} onClose={close} titleId={titleId}>
        <h2 id={titleId} className="text-[19px] font-bold text-ink">
          Editar perfil
        </h2>

        <form action={formAction} className="flex flex-col gap-5">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full">
              <Avatar
                displayName={`${firstName} ${lastName}`.trim() || username}
                imageUrl={preview ?? avatarUrl}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={photoId}
                className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:border-accent hover:text-ink"
              >
                <Camera size={15} aria-hidden="true" />
                Cambiar foto
              </label>
              <input
                id={photoId}
                name="avatar"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setPreview(file ? URL.createObjectURL(file) : null);
                }}
              />
              <p className="text-xs text-ink-muted">
                JPG, PNG o WebP. Máximo 5 MB.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={firstNameId} className="text-sm text-ink-muted">
                Nombre
              </label>
              <input
                id={firstNameId}
                name="first_name"
                type="text"
                defaultValue={firstName}
                autoComplete="given-name"
                className={FIELD_CLASS}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={lastNameId} className="text-sm text-ink-muted">
                Apellidos
              </label>
              <input
                id={lastNameId}
                name="last_name"
                type="text"
                defaultValue={lastName}
                autoComplete="family-name"
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={usernameId} className="text-sm text-ink-muted">
              Nombre de usuario
            </label>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-sm text-ink-muted">@</span>
              <input
                id={usernameId}
                name="username"
                type="text"
                defaultValue={username}
                minLength={3}
                maxLength={24}
                autoComplete="username"
                className={`${FIELD_CLASS} flex-1 font-mono`}
              />
            </div>
            <p className="text-xs text-ink-muted">
              Entre 3 y 24 caracteres. Es cómo te encuentran los demás.
            </p>
          </div>

          {state.status !== "idle" ? (
            <output
              className={
                state.status === "success"
                  ? "text-sm text-accent"
                  : "text-sm text-danger"
              }
            >
              {state.message}
            </output>
          ) : null}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              Cancelar
            </button>
            <SaveButton />
          </div>
        </form>
      </Dialog>
    </>
  );
}
