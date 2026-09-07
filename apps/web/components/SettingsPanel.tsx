"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PRIMARY_ACCENT_THEMES, useTheme } from "@/lib/theme";
import LineIcon from "./LineIcon";

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, accentTheme, setAccentTheme } = useTheme();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Öppna inställningar"
        aria-expanded={open}
        className="group flex h-10 w-10 items-center justify-center rounded-2xl transition-colors hover:bg-paper-secondary active:scale-95"
      >
        <span className="flex items-center gap-[3px]">
          <span className="h-[5px] w-[5px] rounded-full bg-ink-secondary transition-all duration-200 group-hover:bg-accent" />
          <span className="h-[5px] w-[5px] rounded-full bg-ink-secondary transition-all duration-200 delay-[30ms] group-hover:bg-accent" />
          <span className="h-[5px] w-[5px] rounded-full bg-ink-secondary transition-all duration-200 delay-[60ms] group-hover:bg-accent" />
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[260px] overflow-hidden rounded-2xl border border-ink-hairline bg-paper-elevated shadow-float animate-slide-up"
        >
          <div className="p-4 space-y-4">
            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                Läge
              </h3>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border py-2 text-[12.5px] font-medium transition-all ${
                    theme === "light"
                      ? "border-accent bg-accent-tint text-ink"
                      : "border-ink-hairline text-ink-secondary hover:bg-paper-secondary"
                  }`}
                >
                  <LineIcon name="sun" className="h-3.5 w-3.5" /> Ljust
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("cream")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border py-2 text-[12.5px] font-medium transition-all ${
                    theme === "cream"
                      ? "border-accent bg-accent-tint text-ink"
                      : "border-ink-hairline text-ink-secondary hover:bg-paper-secondary"
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-ink-hairline"
                    style={{ backgroundColor: "#FAF5EC" }}
                  />
                  Cream
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] border py-2 text-[12.5px] font-medium transition-all ${
                    theme === "dark"
                      ? "border-accent bg-accent-tint text-ink"
                      : "border-ink-hairline text-ink-secondary hover:bg-paper-secondary"
                  }`}
                >
                  <LineIcon name="moon" className="h-3.5 w-3.5" /> Mörkt
                </button>
              </div>
            </div>

            <div>
              <h3 className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-muted">
                Färgtema
              </h3>
              <div className="flex gap-1.5">
                {PRIMARY_ACCENT_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAccentTheme(t.id)}
                    title={t.label}
                    aria-label={t.label}
                    className={`flex flex-1 items-center justify-center rounded-[10px] border py-2 transition-all ${
                      accentTheme === t.id
                        ? "border-accent bg-accent-tint"
                        : "border-ink-hairline hover:bg-paper-secondary"
                    }`}
                  >
                    <span
                      className="h-4 w-4 rounded-full border border-ink-hairline shadow-sm"
                      style={{ backgroundColor: t.swatch }}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="h-px bg-ink-hairline" />

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between rounded-[10px] px-2.5 py-2 text-[12.5px] font-medium text-ink-secondary transition-colors hover:bg-paper-secondary hover:text-ink"
            >
              Alla inställningar
              <LineIcon name="chevron-down" className="h-3.5 w-3.5 -rotate-90" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
