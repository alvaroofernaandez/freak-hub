import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { publicRouteMatchers } from "@/shared/lib/routes";

const isPublic = createRouteMatcher(publicRouteMatchers);

/**
 * Next.js 16 renamed the `middleware` convention to `proxy`; the contents are
 * unchanged. Everything is behind the session by default and only the matchers
 * in `publicRouteMatchers` open a route.
 */
export default clerkMiddleware(async (auth, request) => {
  if (!isPublic(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next internals and static assets unless they show up in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    // Always run for Clerk's own frontend API routes.
    "/__clerk/(.*)",
  ],
};
