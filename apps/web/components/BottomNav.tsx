"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LineIcon from "./LineIcon";

const navItems = [
  { href: "/", label: "Dashboard", icon: "grid" as const },
  { href: "/courses", label: "Kurser", icon: "graduation-cap" as const },
  { href: "/classes", label: "Klasser", icon: "users" as const },
  { href: "/review", label: "Granska", icon: "edit" as const },
  { href: "/settings", label: "Inställningar", icon: "settings" as const },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/design-lab" || pathname.startsWith("/design-lab/")) return null;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-equi-300/50 bg-equi-50/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg dark:border-equi-800/50 dark:bg-equi-950/90 md:hidden">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-around px-2">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2 transition-all active:scale-95 ${
                active ? "text-ink" : "text-ink-secondary"
              }`}
            >
              <LineIcon
                name={item.icon}
                className={`h-6 w-6 transition-transform ${active ? "scale-110" : ""}`}
              />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
