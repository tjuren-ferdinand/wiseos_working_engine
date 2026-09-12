import type { ReactNode } from "react";
import type { Metadata } from "next";
import { LOGO_MARK } from "@/lib/logo";

export const metadata: Metadata = {
  title: "WiseOS — Mindre administration. Mer undervisning.",
  description:
    "WiseOS använder AI för att läsa, förstå och bedöma handskrivna elevlösningar — med läraren i kontroll över varje poäng och varje beslut.",
  openGraph: {
    title: "WiseOS — Mindre administration. Mer undervisning.",
    description:
      "WiseOS använder AI för att läsa, förstå och bedöma handskrivna elevlösningar — med läraren i kontroll över varje poäng och varje beslut.",
    type: "website",
    locale: "sv_SE",
  },
  twitter: {
    card: "summary_large_image",
    title: "WiseOS — Mindre administration. Mer undervisning.",
    description:
      "AI-driven rättning av handskrivna elevlösningar. Matte · Fysik · Kemi.",
  },
  icons: {
    icon: LOGO_MARK,
  },
};

export default function LoginLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
            document.documentElement.classList.remove('dark', 'cream');
            document.documentElement.classList.add('light');
            try { localStorage.setItem('wiseos-theme', 'light'); } catch (e) {}
          })();`,
        }}
      />
      {children}
    </>
  );
}
