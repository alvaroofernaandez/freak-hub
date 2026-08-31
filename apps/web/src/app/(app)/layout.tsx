import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";

/**
 * Shell for every authenticated route. `middleware.ts` already guarantees a
 * session here, so this layout only renders chrome.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/inicio"
            className="font-mono text-sm uppercase tracking-widest"
          >
            Freak Hub
          </Link>
          <div className="flex items-center gap-4">
            {user?.username ? (
              <span className="hidden text-sm text-content-muted sm:inline">
                @{user.username}
              </span>
            ) : null}
            <UserButton />
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
