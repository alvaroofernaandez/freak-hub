import { UserProfile } from "@clerk/nextjs";

/**
 * Account management, handed to Clerk.
 *
 * `UserMenu` replaced Clerk's `<UserButton>` because that surface was ours to
 * design (docs/design.md#el-menú-de-sesión-es-nuestro-no-de-clerk). This one
 * is not the same case: e-mail addresses, passwords, connected accounts and
 * second factors are Clerk's own data, with Clerk's own flows behind them, and
 * rebuilding that would mean reimplementing verification, not restyling a
 * menu.
 *
 * `routing="hash"` keeps the whole widget inside /ajustes: its internal
 * navigation lives in the fragment, so no catch-all route is needed and the
 * page around it never unmounts.
 */
export function AccountPanel() {
  return (
    // The widget has a minimum width of its own. On a 390px screen it scrolls
    // inside this box instead of pushing the page sideways.
    <div className="overflow-x-auto">
      <UserProfile routing="hash" />
    </div>
  );
}
