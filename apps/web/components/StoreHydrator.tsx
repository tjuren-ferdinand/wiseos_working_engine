"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { actions, useStore } from "@/lib/store";

/**
 * Hämtar klasser, prov och rättningsresultat från backend en gång vid mount.
 * Renderar inget - lägg i root layout ovanför sidorna som konsumerar store:n.
 */
export default function StoreHydrator() {
  const pathname = usePathname();
  const hydrated = useStore((s) => s.hydrated);
  const error = useStore((s) => s.error);
  // Publika sidor ska aldrig anropa backend — hydrate() utan session får
  // 403 som annars tolkas som allowlist-nekad och redirectar i en loop.
  const isolated =
    pathname === "/design-lab" ||
    pathname.startsWith("/design-lab/") ||
    pathname === "/login" ||
    pathname === "/demo" ||
    pathname.startsWith("/demo/") ||
    pathname === "/faq" ||
    pathname === "/legal" ||
    pathname.endsWith("/print");

  useEffect(() => {
    if (!isolated && !hydrated) {
      actions.hydrate();
    }
  }, [hydrated, isolated]);

  if (isolated) return null;

  if (error && !hydrated) {
    return (
      <div className="mx-auto mt-24 max-w-lg rounded-[14px] border border-state-danger/20 bg-state-danger/10 p-5 text-[14px] text-state-danger">
        Kunde inte ansluta till backend: {error}. Kontrollera att API-servern körs.
      </div>
    );
  }

  return null;
}
