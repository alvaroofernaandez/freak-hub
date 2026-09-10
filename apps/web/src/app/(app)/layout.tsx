import { currentUser } from "@clerk/nextjs/server";
import { UserMenu } from "@/features/members/ui/user-menu";
import {
  ActiveCategoryProvider,
  CategoryStripeHost,
} from "@/shared/ui/active-category";
import {
  AddCategoryModalDimmer,
  AddCategoryModalHost,
  AddCategoryModalProvider,
} from "@/shared/ui/add-category-modal";
import { Navbar } from "@/shared/ui/navbar";

/**
 * Shell for every authenticated route. `middleware.ts` already guarantees a
 * session here, so this layout only renders chrome.
 *
 * AddCategoryModalDimmer wraps the navbar, stripe and page content (not
 * AddCategoryModalHost) so all of it goes aria-hidden and out of pointer reach
 * behind the "add a work" modal while it's open (issue #26). The dimming
 * itself is the Dialog overlay's job (docs/design.md#los-modales).
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();

  return (
    <AddCategoryModalProvider>
      <ActiveCategoryProvider>
        <AddCategoryModalDimmer>
          <Navbar
            userSlot={
              user?.username ? (
                <UserMenu
                  displayName={user.fullName ?? user.username}
                  username={user.username}
                  avatarUrl={user.imageUrl}
                />
              ) : null
            }
          />
          <CategoryStripeHost />
          <main
            id="contenido"
            className="mx-auto w-full max-w-5xl flex-1 px-6 pt-10 pb-24 md:pb-10"
          >
            {children}
          </main>
        </AddCategoryModalDimmer>
        <AddCategoryModalHost />
      </ActiveCategoryProvider>
    </AddCategoryModalProvider>
  );
}
