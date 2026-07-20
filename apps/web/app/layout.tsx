import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import Sidebar from "@/components/Sidebar";
import Onboarding from "@/components/Onboarding";

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
  themeColor: "#1a1a1a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Caveat:wght@400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen antialiased">
        <ThemeProvider>
          <Onboarding />
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 ml-[240px] min-h-screen">
              <div className="px-12 py-14 max-w-6xl">
                {children}
              </div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
