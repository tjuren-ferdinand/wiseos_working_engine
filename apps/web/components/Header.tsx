"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LineIcon from "./LineIcon";
import ThemeToggle from "./ThemeToggle";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/courses", label: "Kurser" },
  { href: "/classes", label: "Klasser" },
  { href: "/review", label: "Granska" },
];

export default function Header() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 h-16 border-b border-equi-300/50 bg-equi-50/80 backdrop-blur-lg dark:border-equi-800/50 dark:bg-equi-950/80 safe-area-inset-top">
      <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-equi-50 text-xs font-semibold">
            W
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">WiseOS</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? "bg-ink text-equi-50"
                  : "text-muted hover:bg-equi-100 dark:hover:bg-equi-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <ThemeToggle />
      </div>
    </header>
  );
}
