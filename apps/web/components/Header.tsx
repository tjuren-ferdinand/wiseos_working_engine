"use client";

import LineIcon from "./LineIcon";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

export default function Header() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const p = await api.listPending();
        if (alive) setPendingCount(p.length);
      } catch {
        // ignorera – API kanske ligger nere
      }
    };
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  const navLinks = [
    { href: "/", label: "Mina klasser" },
    { href: "/classes/new", label: "Skapa klass" },
    { href: "/review", label: "Granska", badge: pendingCount },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <Link
          href="/"
          className="flex flex-col justify-center"
          onClick={() => setOpen(false)}
        >
          <span className="font-semibold text-slate-900 text-lg leading-none tracking-tight">
            WiseOS
          </span>
          <span className="text-[10px] text-slate-400 tracking-wider uppercase leading-none mt-1">
            by Wisecast
          </span>
        </Link>

        {/* Desktop-nav */}
        <nav className="hidden sm:flex items-center gap-6 text-sm">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`relative transition-colors ${pathname === l.href ? "text-slate-900 font-semibold" : "text-slate-500 hover:text-slate-900"}`}
            >
              {l.label}
              {l.badge != null && l.badge > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-[10px] font-bold h-5 min-w-[20px] px-1">
                  {l.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Mobil-knapp */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Meny"
          className="sm:hidden relative grid h-10 w-10 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 active:bg-slate-200"
        >
          <LineIcon name={open ? "x" : "menu"} className="h-5 w-5" />
          {pendingCount != null && pendingCount > 0 && !open && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-[10px] font-bold h-4 min-w-[16px] px-1">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobil-meny */}
      {open && (
        <nav className="sm:hidden border-t border-slate-100 bg-white/95 backdrop-blur-xl px-4 py-2">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`flex items-center justify-between py-3 border-b border-slate-100 last:border-0 text-base ${
                pathname === l.href ? "text-slate-900 font-semibold" : "text-slate-600"
              }`}
            >
              <span>{l.label}</span>
              {l.badge != null && l.badge > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-slate-900 text-white text-xs font-bold h-6 min-w-[24px] px-1.5">
                  {l.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
