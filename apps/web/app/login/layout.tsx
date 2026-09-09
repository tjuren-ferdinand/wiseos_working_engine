import type { ReactNode } from "react";
import type { Metadata } from "next";
import { LOGO_MARK } from "@/lib/logo";

export const metadata: Metadata = {
  title: "WiseOS — Rätta prov på minuter, inte kvällar",
  description:
    "AI-driven rättning för svenska lärare. Spara tid, ge tydlig feedback och behåll kontrollen över betygen.",
  openGraph: {
    title: "WiseOS — Rätta prov på minuter, inte kvällar",
    description:
      "AI-driven rättning för svenska lärare. Spara tid, ge tydlig feedback och behåll kontrollen över betygen.",
    type: "website",
    locale: "sv_SE",
  },
  twitter: {
    card: "summary_large_image",
    title: "WiseOS — Rätta prov på minuter, inte kvällar",
    description:
      "AI-driven rättning för svenska lärare.",
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
          __html: `(function(){ document.documentElement.classList.add('dark'); })();`,
        }}
      />
      {children}
    </>
  );
}
