"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useTheme } from "@/lib/theme";
import LineIcon from "@/components/LineIcon";
import { LOGO_MARK_DARK, LOGO_MARK_LIGHT } from "@/lib/logo";

const NAV = [
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
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const isDark = theme === "dark";
  const isCream = theme === "cream";
  const isPublic =
    pathname === "/login" ||
    pathname === "/faq" ||
    pathname === "/legal" ||
    pathname === "/_not-found";

  if (isPublic) {
    return <>{children}</>;
  }

  const title = getTitle(pathname);

  return (
    <div className="fixed inset-0 z-0 flex overflow-hidden bg-paper text-ink">
      {/* Rail */}
      <aside className="z-50 flex h-full w-16 flex-col items-center border-r border-ink-hairline bg-paper py-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-8 rounded-xl p-2 hover:bg-ink/5"
          aria-label="WiseOS översikt"
        >
          <Image
            src={isDark ? LOGO_MARK_DARK : LOGO_MARK_LIGHT}
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
        </button>

        <nav className="flex w-full flex-1 flex-col items-center gap-1 px-2" aria-label="Huvudnavigation">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-xl transition-all",
                  active
                    ? "bg-surface-2 text-ink border border-ink-hairline shadow-soft"
                    : "text-ink-secondary hover:bg-ink/5 hover:text-ink",
                ].join(" ")}
              >
                <LineIcon name={item.icon as any} className="h-[18px] w-[18px]" />
              </button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={toggleTheme}
          className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl text-ink-secondary hover:bg-ink/5"
          aria-label={isDark ? "Ljust tema" : "Mörkt tema"}
        >
          <LineIcon name={isDark ? "sun" : "moon"} className="h-5 w-5" />
        </button>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper text-xs font-semibold">
          S
        </div>
      </aside>

      {/* Workspace */}
      <section className="ml-16 flex h-full w-[calc(100%-4rem)] flex-col">
        <header className="flex h-14 flex-none items-center justify-between border-b border-ink-hairline bg-paper/80 px-5 backdrop-blur-sm">
          <h1 className="text-[15px] font-medium tracking-tight text-ink">{title}</h1>
          <div className="flex items-center gap-2" />
        </header>

        <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      </section>
    </div>
  );
}
