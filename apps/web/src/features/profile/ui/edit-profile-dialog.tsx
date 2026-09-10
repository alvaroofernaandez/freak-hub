"use client";

import { useRouter } from "next/navigation";
import {
  type FormEvent,
  useActionState,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { Camera, Pen } from "reicon-react";
import { Avatar } from "@/features/members/ui/avatar";
import {
  type ProfileFormState,
  updateProfile,
} from "@/features/profile/actions/update-profile";
import {
  AVATAR_ACCEPTED_TYPES,
  AVATAR_MAX_BYTES,
} from "@/shared/errors/messages";
import { Dialog } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/form-field";
import { PendingLabel } from "@/shared/ui/pending-label";
import { InlineMessage } from "@/shared/ui/state/inline-message";

type EditProfileDialogProps = {
  firstName: string;
  lastName: string;
  username: string;
  avatarUrl?: string | null;
};

const INITIAL_STATE: ProfileFormState = { status: "idle", message: "" };

const FIELD_CLASS =
  "rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted";

const AVATAR_HELPER_TEXT = "JPEG, PNG, WEBP o GIF, hasta 5 MB.";

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <PendingLabel
        pending={pending}
        idleLabel="Guardar cambios"
        pendingLabel="Guardando…"
      />
    </button>
  );
}

/**
 * Edits your own profile without showing Clerk. The server action posts to the
 * Go API, which is the only thing that talks to Clerk's Backend API; Clerk's
 * `user.updated` webhook then syncs the `members` row.
 *
 * The form submits through a manual `onSubmit` instead of `<form action>`:
 * React resets every uncontrolled field once a form action tied to `action`
 * settles, success or not, which would wipe both the typed fields and the
 * selected photo right after a recoverable failure. Reading the DOM's own
 * `FormData` at submit time keeps them exactly as the browser already does
 * for any other client-validated form.
 */
export function EditProfileDialog({
  firstName,
  lastName,
  username,
  avatarUrl,
}: EditProfileDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    updateProfile,
    INITIAL_STATE,
  );
  const [preview, setPreview] = useState<string | null>(null);
  const [avatarClientError, setAvatarClientError] = useState<string>();
  const [dirty, setDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const titleId = useId();
  const confirmTitleId = useId();
  const firstNameId = useId();
  const lastNameId = useId();
  const usernameId = useId();
  const photoId = useId();
  const avatarHelperId = `${photoId}-helper`;
  const avatarErrorId = `${photoId}-error`;
  const router = useRouter();
  const usernameRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const usernameError = state.fieldErrors?.find(
    (error) => error.field === "username",
  )?.message;
  const avatarServerError = state.fieldErrors?.find(
    (error) => error.field === "avatar",
  )?.message;
  const avatarError = avatarClientError ?? avatarServerError;
  // A form-level message only when the failure doesn't tie to a field —
  // each field's own error already says it there.
  const formError =
    state.status === "error" && !usernameError && !avatarError
      ? state.message
      : undefined;

  useEffect(() => {
    if (state.status === "success") {
      setDirty(false);
      router.refresh();
      return;
    }
    if (state.status === "error") {
      if (avatarServerError) {
        photoRef.current?.focus();
      } else if (usernameError) {
        usernameRef.current?.focus();
      }
    }
  }, [state, router, usernameError, avatarServerError]);

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
    setConfirmDiscardOpen(false);
    setPreview(null);
    setAvatarClientError(undefined);
    setDirty(false);
  }

  function requestClose() {
    if (dirty) {
      setConfirmDiscardOpen(true);
      return;
    }
    close();
  }

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarClientError(
        `La foto pesa más de 5 MB. Prueba con una más ligera.`,
      );
      event.target.value = "";
      return;
    }

    if (!(AVATAR_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
      setAvatarClientError("Ese archivo no es una imagen válida.");
      event.target.value = "";
      return;
    }

    setAvatarClientError(undefined);
    setPreview(URL.createObjectURL(file));
    setDirty(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    formAction(new FormData(event.currentTarget));
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

      <Dialog isOpen={isOpen} onClose={requestClose} titleId={titleId}>
        <h2 id={titleId} className="text-[19px] font-bold text-ink">
          Editar perfil
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                ref={photoRef}
                name="avatar"
                type="file"
                accept="image/*"
                aria-invalid={avatarError ? true : undefined}
                aria-describedby={avatarError ? avatarErrorId : avatarHelperId}
                className="sr-only"
                onChange={handlePhotoChange}
              />
              {avatarError ? (
                <p
                  id={avatarErrorId}
                  role="alert"
                  className="text-xs text-danger"
                >
                  {avatarError}
                </p>
              ) : (
                <p id={avatarHelperId} className="text-xs text-ink-muted">
                  {AVATAR_HELPER_TEXT}
                </p>
              )}
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
                onChange={() => setDirty(true)}
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
                onChange={() => setDirty(true)}
                className={FIELD_CLASS}
              />
            </div>
          </div>

          <FormField
            id={usernameId}
            label="Nombre de usuario"
            helperText={
              usernameError
                ? undefined
                : "Entre 3 y 24 caracteres. Es cómo te encuentran los demás."
            }
            errorText={usernameError}
          >
            {(aria) => (
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-sm text-ink-muted">@</span>
                <input
                  {...aria}
                  ref={usernameRef}
                  name="username"
                  type="text"
                  defaultValue={username}
                  minLength={3}
                  maxLength={24}
                  autoComplete="username"
                  onChange={() => setDirty(true)}
                  className={`${FIELD_CLASS} min-w-0 flex-1 font-mono`}
                />
              </div>
            )}
          </FormField>

          {state.status === "success" ? (
            <InlineMessage tone="success">{state.message}</InlineMessage>
          ) : null}
          {formError ? (
            <InlineMessage tone="error" afterUserAction>
              {formError}
            </InlineMessage>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={requestClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-ink-muted transition-colors duration-150 hover:text-ink"
            >
              Cancelar
            </button>
            <SaveButton pending={isPending} />
          </div>
        </form>
      </Dialog>

      <Dialog
        isOpen={confirmDiscardOpen}
        onClose={() => setConfirmDiscardOpen(false)}
        titleId={confirmTitleId}
        maxWidthClassName="max-w-[420px]"
      >
        <h2 id={confirmTitleId} className="text-[17px] font-bold text-ink">
          ¿Descartar los cambios?
        </h2>
        <p className="text-sm text-ink-muted">
          Perderás los cambios que no has guardado.
        </p>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmDiscardOpen(false)}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90"
          >
            Seguir editando
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-lg border border-danger/40 px-4 py-2.5 text-sm font-medium text-danger transition-colors duration-150 hover:bg-danger-soft"
          >
            Descartar
          </button>
        </div>
      </Dialog>
    </>
  );
}
