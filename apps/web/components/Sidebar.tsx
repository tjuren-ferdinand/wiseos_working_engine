"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme";
import LineIcon from "./LineIcon";

const navItems = [
  { href: "/", label: "Dashboard", icon: "grid" as const },
  { href: "/courses", label: "Kurser", icon: "graduation-cap" as const },
  { href: "/review", label: "Rättning", icon: "edit" as const },
  { href: "/results", label: "Resultat", icon: "chart" as const },
  { href: "/settings", label: "Inställningar", icon: "settings" as const },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  // Theme-aware token classes. In light: bright surface, dark ink. In dark: dark surface, light ink.
  const panel = isDark ? "bg-paper-raised border-paper-raised/[0.06] shadow-card" : "bg-paper-elevated border-ink-hairline shadow-card";
  const wordmarkDot = "bg-ink";
  const wordmarkText = "text-ink";
  const hairline = isDark ? "bg-paper-raised/[0.06]" : "bg-ink-hairline";
  const navActive = isDark ? "bg-paper-raised/[0.06] text-ink" : "bg-ink/[0.04] text-ink";
  const navInactive = isDark ? "text-ink-muted hover:text-ink-secondary hover:bg-paper-raised/[0.03]" : "text-ink-secondary hover:text-ink hover:bg-ink/[0.03]";
  const metaText = "text-ink-muted";

  return (
    // Floating spatial nav surface — inset from the viewport edges.
    <aside className="fixed left-4 top-4 bottom-4 w-[216px] z-40 flex flex-col">
      <div className={`flex-1 flex flex-col rounded-[18px] border overflow-hidden ${panel}`}>
        {/* Wordmark */}
        <div className="px-5 pt-5 pb-4">
          <Link href="/" className="group inline-flex items-center gap-2.5">
            <span className={`relative flex h-6 w-6 items-center justify-center rounded-[7px] border ${isDark ? "bg-paper-raised/[0.06] border-paper-raised/[0.08]" : "bg-ink/[0.03] border-ink-hairline"}`}>
              <span className={`h-[6px] w-[6px] rounded-full ${wordmarkDot}`} />
            </span>
            <span className={`text-[14px] font-medium tracking-[-0.01em] ${wordmarkText}`}>
              WiseOS
            </span>
          </Link>
        </div>

        <div className={`h-px mx-5 ${hairline}`} />

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-4">
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-150 ${
                      active ? navActive : navInactive
                    }`}
                  >
                    <LineIcon
                      name={item.icon}
                      className={`h-[15px] w-[15px] transition-opacity duration-150 ${
                        active ? "opacity-100" : "opacity-70 group-hover:opacity-90"
                      }`}
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Theme toggle & status */}
        <div className="px-3 pb-4 pt-3 space-y-3">
          <div className={`h-px mx-2 ${hairline}`} />

          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-[12.5px] font-medium transition-all duration-150 ${
              isDark ? "text-ink-muted hover:text-ink-secondary hover:bg-paper-raised/[0.03]" : "text-ink-secondary hover:text-ink hover:bg-ink/[0.03]"
            }`}
          >
            <LineIcon name={isDark ? "moon" : "sun"} className="h-3.5 w-3.5" />
            {isDark ? "Mörkt läge" : "Ljust läge"}
          </button>

          <div className="flex items-center gap-2 px-3">
            <span className="relative flex-shrink-0 h-[5px] w-[5px]">
              <span className={`absolute inset-0 rounded-full ${wordmarkDot}`} />
              <span className={`absolute inset-0 rounded-full ${wordmarkDot} animate-ping opacity-50`} />
            </span>
            <span className={`text-[11px] ${metaText}`}>
              AI-rättning tillgänglig
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
