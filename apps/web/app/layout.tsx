import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LOGO_MARK } from "@/lib/logo";
import { ThemeProvider } from "@/lib/theme";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Onboarding from "@/components/Onboarding";
import Splash from "@/components/Splash";
import StoreHydrator from "@/components/StoreHydrator";

export const metadata: Metadata = {
  title: "WiseOS",
  description: "Wisecast AB · Mathematica-driven rättning för svenska skolor",
  icons: {
    icon: { url: LOGO_MARK, type: "image/png", sizes: "any" },
    shortcut: LOGO_MARK,
    apple: LOGO_MARK,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090B",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" suppressHydrationWarning className="dark" data-theme="ice">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Caveat:wght@400;500;600&family=Poppins:wght@300;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen w-full antialiased bg-paper text-ink">
        <ThemeProvider>
          <StoreHydrator />
          <Splash>
            <Header />
            <main className="flex min-h-screen w-full flex-col pt-20 pb-28">
              {children}
            </main>
            <BottomNav />
          </Splash>
          <Onboarding />
        </ThemeProvider>
      </body>
    </html>
  );
}
