import { UserButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import {
  ActiveCategoryProvider,
  CategoryStripeHost,
} from "@/shared/ui/active-category";
import { Navbar } from "@/shared/ui/navbar";

/**
 * Shell for every authenticated route. `middleware.ts` already guarantees a
 * session here, so this layout only renders chrome.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();

  return (
    <ActiveCategoryProvider>
      <div className="flex min-h-dvh flex-col">
        <Navbar
          userSlot={
            <div className="flex items-center gap-4">
              {user?.username ? (
                <span className="hidden text-sm text-ink-muted sm:inline">
                  @{user.username}
                </span>
              ) : null}
              <UserButton />
            </div>
          }
        />
        <CategoryStripeHost />
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 pt-10 pb-24 md:pb-10">
          {children}
        </main>
      </div>
    </ActiveCategoryProvider>
  );
}
