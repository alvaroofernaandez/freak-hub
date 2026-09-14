import { esES } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Bungee, JetBrains_Mono, Sora } from "next/font/google";
import { THEME_COLOR, THEME_INIT_SCRIPT } from "@/shared/lib/theme";
import { MotionProvider } from "@/shared/motion/motion-provider";
import { OfflineNotice } from "@/shared/ui/offline-notice";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const bungee = Bungee({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-bungee",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Freak Hub",
    template: "%s · Freak Hub",
  },
  description:
    "La biblioteca compartida del grupo: anime, manga, videojuegos, películas, juegos de mesa y TCG.",
  // Closed community: keep it out of search engines.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // The dark default. `THEME_INIT_SCRIPT` rewrites it before first paint when
  // the visitor chose light, and `useTheme` keeps it in step afterwards.
  themeColor: THEME_COLOR.dark,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${sora.variable} ${bungee.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-dvh antialiased">
        {/*
         * Reads the stored theme and stamps it on <html> before a single
         * pixel is painted. Resolving it after hydration instead would show
         * everyone on the light theme a dark flash on every cold load, and
         * there is no server-side way to know: the choice lives in this
         * browser's localStorage, not in a cookie or in the session.
         */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a constant this module builds itself, with no user input anywhere near it. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />

        {/* Core 3 requires the provider inside <body>, not wrapping <html>. */}
        <ClerkProvider localization={esES}>
          <MotionProvider>
            <div className="sticky top-0 z-50">
              <OfflineNotice />
            </div>
            {children}
          </MotionProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
