import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6 py-16">
      <SignIn />
    </main>
  );
}
