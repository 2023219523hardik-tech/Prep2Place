import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import ProfileCompletionGuard from "@/components/ProfileCompletionGuard";
import { GlobalToastPortal } from "@/components/ui/Toast";
import ClientShellRouter from "@/components/layout/ClientShellRouter";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Prep2Place - AI Placement Readiness Platform",
  description: "Learn, practice, and get placed: coding practice, aptitude tests, AI mock interviews and placement readiness scoring, all in one platform.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/logo-icon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/logo-icon-48.png", type: "image/png", sizes: "48x48" },
    ],
    apple: [{ url: "/logo-icon-180.png", sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="font-sans">
        <AuthProvider>
          <GlobalToastPortal />
          <ProfileCompletionGuard />
          <Suspense fallback={null}>
            <ClientShellRouter>{children}</ClientShellRouter>
          </Suspense>
        </AuthProvider>
      </body>
    </html>
  );
}
