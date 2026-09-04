import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Registro" };

/**
 * Sign-up is only reachable with a valid Clerk invitation: the instance runs in
 * `restricted` mode, so Clerk itself rejects anyone arriving without a ticket.
 */
export default function SignUpPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 py-16">
      <SignUp />
      <p className="max-w-sm text-center text-sm text-ink-muted">
        ¿No tienes invitación? Pídesela a cualquier persona que ya esté dentro:
        todos los miembros pueden invitar.
      </p>
    </main>
  );
}
