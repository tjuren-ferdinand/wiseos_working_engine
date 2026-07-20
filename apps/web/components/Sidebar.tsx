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

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const isDark = theme === "dark";

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 w-[240px] flex flex-col z-40 transition-all duration-500 ${
        isDark
          ? "bg-[#0f0f0f]/80 backdrop-blur-2xl border-r border-white/[0.06]"
          : "bg-white/70 backdrop-blur-2xl border-r border-slate-200/50"
      }`}
    >
      {/* Logo */}
      <div className="px-5 py-7">
        <Link href="/" className="group flex items-center gap-3 overflow-hidden">
          {/* Logo mark */}
          <div className="relative flex-shrink-0 transition-transform duration-300 ease-out group-hover:scale-105">
            <img 
              src="/logotype_new.png" 
              alt="WiseOS" 
              className="h-10 w-auto object-contain"
            />
          </div>
          
          {/* Text with slide-in animation */}
          <div className="relative overflow-hidden">
            <span 
              className={`block text-[22px] font-semibold tracking-tight transition-all duration-500 ease-out ${
                isDark ? "text-white" : "text-slate-800"
              }`}
              style={{
                background: isDark 
                  ? "linear-gradient(135deg, #ffffff 0%, #e8b0e4 100%)"
                  : "linear-gradient(135deg, #1e293b 0%, #9B5A97 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              WiseOS
            </span>
            {/* Animated underline on hover */}
            <span 
              className={`absolute bottom-0 left-0 h-[2px] w-0 transition-all duration-300 ease-out group-hover:w-full ${
                isDark ? "bg-[#e8b0e4]/50" : "bg-[#9B5A97]/30"
              }`}
            />
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`group relative flex items-center gap-3 px-4 py-3 rounded-2xl text-[14px] font-medium transition-all duration-200 ${
                    active
                      ? isDark
                        ? "bg-[#e8b0e4]/15 text-white"
                        : "bg-slate-900 text-white"
                      : isDark
                      ? "text-white/50 hover:text-white hover:bg-white/[0.04]"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-100/80"
                  }`}
                >
                  {active && (
                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full ${
                      isDark ? "bg-[#e8b0e4]" : "bg-white"
                    }`} />
                  )}
                  <LineIcon name={item.icon} className={`h-[18px] w-[18px] transition-transform duration-200 ${
                    active ? "scale-110" : "group-hover:scale-105"
                  }`} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Theme Toggle & Info */}
      <div className="px-4 pb-6 space-y-3">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-200 ${
            isDark
              ? "bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white"
              : "bg-slate-100/80 hover:bg-slate-200/80 text-slate-500 hover:text-slate-900"
          }`}
        >
          <span className="text-[13px] font-medium">Tema</span>
          <div className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-medium ${
            isDark ? "bg-white/10" : "bg-white shadow-sm"
          }`}>
            <LineIcon name={isDark ? "moon" : "sun"} className="h-3.5 w-3.5" />
            {isDark ? "Mörkt" : "Ljust"}
          </div>
        </button>

        {/* System Status */}
        <div
          className={`rounded-2xl px-4 py-3.5 ${
            isDark
              ? "bg-white/[0.03] border border-white/[0.06]"
              : "bg-slate-50/80 border border-slate-200/60"
          }`}
        >
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <div className="relative flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-[#22C55E]" />
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#22C55E] animate-ping opacity-75" />
            </div>
            
            <div className="min-w-0">
              <div className={`text-[13px] font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                WiseOS aktiv
              </div>
              <div className={`text-[11px] ${isDark ? "text-white/40" : "text-slate-500"}`}>
                AI-rättning tillgänglig
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
