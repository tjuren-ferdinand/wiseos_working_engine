import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import Sidebar from "@/components/Sidebar";
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
      <body className="min-h-screen antialiased bg-paper text-ink">
        <ThemeProvider>
          <Splash>
            <Onboarding />
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 ml-[248px] min-h-screen">
                <div className="mx-auto w-full max-w-[1180px] px-6 sm:px-10 py-10 sm:py-12">
                  {children}
                </div>
              </main>
            </div>
          </Splash>
        </ThemeProvider>
      </body>
    </html>
  );
}
