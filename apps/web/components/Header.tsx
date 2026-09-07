"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";
import SettingsPanel from "./SettingsPanel";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/courses", label: "Kurser" },
  { href: "/classes", label: "Klasser" },
  { href: "/review", label: "Granska" },
];

export default function Header() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/design-lab" || pathname.startsWith("/design-lab/")) return null;

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-16 border-b border-ink-hairline bg-paper/80 backdrop-blur-lg shadow-sm dark:border-ink-hairline dark:bg-paper-elevated/80 safe-area-inset-top">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-5">
        <Link href="/" className="group flex h-11 items-center gap-2">
          <Logo className="h-7 w-7 object-contain" alt="" />
          <span className="text-[15px] font-semibold tracking-tight leading-none text-ink max-w-0 opacity-0 overflow-hidden transition-all duration-300 group-hover:max-w-[5.5rem] group-hover:opacity-100 whitespace-nowrap">
            WiseOS
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-ink text-paper"
                  : "text-ink-secondary hover:bg-paper-secondary"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <SettingsPanel />
      </div>
    </header>
  );
}
