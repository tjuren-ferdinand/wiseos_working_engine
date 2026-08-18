import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Onboarding from "@/components/Onboarding";
import Splash from "@/components/Splash";

export const metadata: Metadata = {
  title: "WiseOS",
  description: "Wisecast AB · Mathematica-driven rättning för svenska skolor",
  icons: {
    icon: [
      { url: "/logotype_black.png?v=6", type: "image/png", sizes: "any" },
    ],
    shortcut: "/logotype_black.png?v=6",
    apple: "/logotype_black.png?v=6",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Caveat:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen antialiased bg-equi-50 text-ink dark:bg-equi-950">
        <ThemeProvider>
          <Splash>
            <Onboarding />
            <Header />
            <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pt-24 pb-28">
              {children}
            </main>
            <BottomNav />
          </Splash>
        </ThemeProvider>
      </body>
    </html>
  );
}
