import type { Metadata } from "next";
import { InvitationForm } from "@/features/invitations/ui/invitation-form";

export const metadata: Metadata = { title: "Invitar" };

export default function InvitePage() {
  return (
    <section className="max-w-xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">Invitar a alguien</h1>
        <p className="text-ink-muted">
          Freak Hub es una comunidad cerrada: solo se entra por invitación.
          Cualquier miembro puede invitar, y queda registrado quién invitó a
          quién.
        </p>
      </div>
      <InvitationForm />
    </section>
  );
}
