import type { Metadata, Viewport } from "next";
import "./globals.css";
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
    icon: [
      { url: "/header_favicon.png", type: "image/png", sizes: "any" },
    ],
    shortcut: "/header_favicon.png",
    apple: "/header_favicon.png",
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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Caveat:wght@400;500;600&family=Poppins:wght@300;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen antialiased bg-paper text-ink">
        <ThemeProvider>
          <StoreHydrator />
          <Splash>
            <Header />
            <main className="mx-auto min-h-screen w-full max-w-5xl px-5 pt-24 pb-28">
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
