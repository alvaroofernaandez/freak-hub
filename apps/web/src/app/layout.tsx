import { esES } from "@clerk/localizations";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Bungee, JetBrains_Mono, Sora } from "next/font/google";
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
  themeColor: "oklch(0.130 0.020 272)",
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
        {/* Core 3 requires the provider inside <body>, not wrapping <html>. */}
        <ClerkProvider localization={esES}>{children}</ClerkProvider>
      </body>
    </html>
  );
}
