"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { useTheme } from "@/lib/theme";
import LineIcon, { type IconName } from "@/components/LineIcon";
import { LOGO_MARK_DARK, LOGO_MARK_LIGHT } from "@/lib/logo";
import { createClient } from "@/lib/supabase/client";

const NAV: { label: string; href: string; icon: IconName }[] = [
  { label: "Översikt", href: "/", icon: "grid" },
  { label: "Kurser", href: "/courses", icon: "stack" },
  { label: "Klasser", href: "/classes", icon: "users" },
  { label: "Granskning", href: "/review", icon: "pen" },
  { label: "Inställningar", href: "/settings", icon: "settings" },
];

function getTitle(pathname: string) {
  if (pathname === "/") return "Översikt";
  if (pathname.startsWith("/courses")) return "Kurser";
  if (pathname.startsWith("/classes")) return "Klasser";
  if (pathname.startsWith("/review")) return "Granskning";
  if (pathname.startsWith("/settings")) return "Inställningar";
  if (pathname.startsWith("/results")) return "Resultat";
  if (pathname.startsWith("/student")) return "Elev";
  return "WiseOS";
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [user, setUser] = useState<User | null>(null);

  const isDark = theme === "dark";
  const nextThemeLabel = theme === "light" ? "Byt till krämtema" : theme === "cream" ? "Byt till mörkt tema" : "Byt till ljust tema";
  const isPublic =
    pathname === "/login" ||
    pathname === "/demo" ||
    pathname.startsWith("/demo/") ||
    pathname === "/faq" ||
    pathname === "/legal" ||
    pathname === "/_not-found" ||
    pathname.endsWith("/print");

  useEffect(() => {
    if (isPublic) {
      setUser(null);
      return;
    }
    const { data: { subscription } } = createClient().auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, [isPublic]);

  if (isPublic) {
    return <>{children}</>;
  }

  const metadata: Record<string, unknown> = user?.user_metadata ?? {};
  const name = [metadata.name, metadata.full_name, metadata.display_name]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0)?.trim();
  const identity = name || user?.email || "";
  const parts = (name || user?.email?.split("@")[0] || "").split(/[\s._-]+/).filter(Boolean);
  const initials = parts.length > 1
    ? `${Array.from(parts[0])[0]}${Array.from(parts[parts.length - 1])[0]}`.toLocaleUpperCase("sv-SE")
    : Array.from(parts[0] || "").slice(0, 2).join("").toLocaleUpperCase("sv-SE");
  const title = getTitle(pathname);

  return (
    <div className="fixed inset-0 z-0 flex flex-col overflow-hidden bg-paper text-ink md:flex-row">
      {/* Rail — desktop (left vertical) */}
      <aside className="hidden md:flex h-full w-16 flex-none flex-col items-center border-r border-ink-hairline bg-paper py-3">
        <Link
          href="/"
          className="mb-8 rounded-[10px] p-2 hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
          aria-label="WiseOS översikt"
        >
          <Image
            src={isDark ? LOGO_MARK_DARK : LOGO_MARK_LIGHT}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
        </Link>

        <nav className="flex w-full flex-1 flex-col items-center gap-1 px-2" aria-label="Huvudnavigation">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                  active
                    ? "bg-paper-secondary text-ink border border-ink-hairline shadow-soft"
                    : "text-ink-secondary hover:bg-ink/5 hover:text-ink",
                ].join(" ")}
              >
                <LineIcon name={item.icon} className="h-[18px] w-[18px]" />
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={toggleTheme}
          className="btn-tertiary mb-2 h-10 w-10 p-0"
          aria-label={nextThemeLabel}
          title={nextThemeLabel}
        >
          <LineIcon name={theme === "cream" ? "moon" : "sun"} className="h-5 w-5" />
        </button>

        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper text-xs font-medium"
          role="img"
          aria-label={identity ? `Inloggad som ${identity}` : "Användarkonto"}
          title={identity || "Användarkonto"}
        >
          {initials || <LineIcon name="users" className="h-4 w-4" />}
        </div>
      </aside>

      {/* Rail — mobile (bottom horizontal) */}
      <nav className="order-2 flex h-[calc(3.5rem+env(safe-area-inset-bottom))] flex-none items-center justify-around border-t border-ink-hairline bg-paper pb-[env(safe-area-inset-bottom)] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] md:hidden" aria-label="Huvudnavigation">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              className={[
                "flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
                active
                  ? "bg-paper-secondary text-ink border border-ink-hairline"
                  : "text-ink-secondary hover:bg-ink/5 hover:text-ink",
              ].join(" ")}
            >
              <LineIcon name={item.icon} className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      {/* Workspace */}
      <section className="flex min-h-0 flex-1 flex-col">
        <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] flex-none items-center justify-between border-b border-ink-hairline bg-paper/80 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[env(safe-area-inset-top)] backdrop-blur-sm md:h-14 md:px-5 md:pt-0">
          <h1 className="text-[15px] font-medium tracking-tight text-ink">{title}</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="btn-tertiary h-11 w-11 p-0 md:hidden"
              aria-label={nextThemeLabel}
              title={nextThemeLabel}
            >
              <LineIcon name={theme === "cream" ? "moon" : "sun"} className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto max-w-5xl px-5 py-8 md:px-8 md:py-10">
            {children}
          </div>
        </main>
      </section>
    </div>
  );
}
