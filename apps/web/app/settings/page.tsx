"use client";

import { useEffect, useState } from "react";
import LineIcon from "@/components/LineIcon";
import {
  DETAIL_ACCENT_THEMES,
  PRIMARY_ACCENT_THEMES,
  REVIEW_LAYOUTS,
  useTheme,
} from "@/lib/theme";
import { useOnboarding } from "@/components/Onboarding";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";
import ReviewLayoutPreview from "@/components/ui/ReviewLayoutPreview";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-muted">
      {children}
    </h2>
  );
}

export default function SettingsPage() {
  const { theme, setTheme, accentTheme, setAccentTheme, reviewLayout, setReviewLayout } = useTheme();
  const { resetOnboarding } = useOnboarding();
  const isDark = theme === "dark";
  const [showMoreAccents, setShowMoreAccents] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        const name = (u?.user_metadata as Record<string, string> | undefined)?.name;
        const email = u?.email;
        setUserName(name || email?.split("@")[0] || null);
        setUserEmail(email || null);
      });
  }, []);

  const displayName = userName || "lärare";
  const email = userEmail || "—";
  const initial = (displayName[0] || "?").toUpperCase();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.push("/login");
    }
  };

  return (
    <div className="space-y-10 max-w-2xl">
      <PageHeader
        eyebrow="Konfiguration"
        title="Inställningar"
        subtitle="Anpassa WiseOS efter dina preferenser."
      />

      {/* Theme */}
      <section>
        <SectionTitle>Utseende</SectionTitle>
        <Surface padding="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-[10px] grid place-items-center bg-ink/[0.04] border border-ink-hairline text-ink-secondary">
                <LineIcon name={isDark ? "moon" : "sun"} className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[14px] font-medium text-ink">Tema</div>
                <div className="text-[12.5px] text-ink-muted">
                  {isDark ? "Mörkt tema aktivt" : "Ljust tema aktivt"}
                </div>
              </div>
            </div>
            <div className="flex gap-1 rounded-[12px] bg-ink/[0.04] border border-ink-hairline p-1">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center gap-1.5 rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                  theme === "light" ? "bg-paper-raised text-ink shadow-soft" : "text-ink-secondary hover:text-ink"
                }`}
              >
                <LineIcon name="sun" className="h-4 w-4" />
                Ljust
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-1.5 rounded-[9px] px-3.5 py-1.5 text-[13px] font-medium transition-all ${
                  theme === "dark" ? "bg-paper-elevated text-ink shadow-soft" : "text-ink-secondary hover:text-ink"
                }`}
              >
                <LineIcon name="moon" className="h-4 w-4" />
                Mörkt
              </button>
            </div>
          </div>

          <div className="mt-5 border-t border-ink-hairline pt-5">
            <div className="text-[14px] font-medium text-ink mb-3">Färgtema</div>
            <div className="grid grid-cols-3 gap-2">
              {PRIMARY_ACCENT_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setAccentTheme(t.id)}
                  className={`flex items-center gap-2 rounded-[10px] border-2 px-3 py-2.5 text-left transition-all ${
                    accentTheme === t.id
                      ? "border-accent bg-accent-tint ring-1 ring-accent"
                      : "border-ink-hairline hover:bg-paper-secondary"
                  }`}
                >
                  <span
                    className="h-4 w-4 shrink-0 rounded-full border border-ink-hairline shadow-sm"
                    style={{ backgroundColor: t.swatch }}
                  />
                  <span className="text-[12.5px] font-medium text-ink">{t.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowMoreAccents((v) => !v)}
              className="mt-3 flex items-center gap-1 text-[12px] font-medium text-ink-muted hover:text-ink transition-colors"
            >
              <LineIcon name="chevron-down" className={`h-3 w-3 transition-transform ${showMoreAccents ? "rotate-180" : ""}`} />
              {showMoreAccents ? "Färre nyanser" : "Fler nyanser"}
            </button>

            {showMoreAccents && (
              <div className="mt-3 flex flex-wrap gap-2">
                {DETAIL_ACCENT_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAccentTheme(t.id)}
                    title={t.label}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                      accentTheme === t.id ? "border-accent" : "border-transparent hover:border-ink-hairline"
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full border border-ink-hairline shadow-sm"
                      style={{ backgroundColor: t.swatch }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </Surface>
      </section>

      {/* Review layout */}
      <section>
        <SectionTitle>Granskningsvy</SectionTitle>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-secondary">
          Välj hur elevernas rättade prov ska visas när du granskar dem på{" "}
          <span className="font-medium text-ink">Granska</span>-sidan.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {REVIEW_LAYOUTS.map((layout) => (
            <button
              key={layout.id}
              type="button"
              onClick={() => setReviewLayout(layout.id)}
              className={`group flex flex-col overflow-hidden rounded-[14px] border-2 text-left transition-all ${
                reviewLayout === layout.id
                  ? "border-accent ring-1 ring-accent"
                  : "border-ink-hairline hover:bg-paper-secondary"
              }`}
            >
              <ReviewLayoutPreview layout={layout.id} active={reviewLayout === layout.id} />
              <div className="p-3">
                <div className="text-[13px] font-medium text-ink">{layout.label}</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">
                  {layout.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Account */}
      <section>
        <SectionTitle>Konto</SectionTitle>
        <Surface padding="p-5">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-full grid place-items-center text-[15px] font-medium bg-ink/[0.05] border border-ink-hairline text-ink">
              {initial}
            </div>
            <div>
              <div className="text-[14px] font-medium text-ink">{displayName}</div>
              <div className="text-[12.5px] text-ink-muted">{email}</div>
            </div>
          </div>
        </Surface>
      </section>

      {/* Help */}
      <section>
        <SectionTitle>Hjälp & introduktion</SectionTitle>
        <Surface padding="p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-[10px] grid place-items-center bg-ink/[0.04] border border-ink-hairline text-ink-secondary">
                <LineIcon name="play" className="h-5 w-5" />
              </div>
              <div>
                <div className="text-[14px] font-medium text-ink">Introduktion</div>
                <div className="text-[12.5px] text-ink-muted">Lär dig grunderna i WiseOS</div>
              </div>
            </div>
            <button onClick={resetOnboarding} className="btn-secondary">
              Starta igen
            </button>
          </div>
        </Surface>
      </section>

      {/* About */}
      <section>
        <SectionTitle>Om WiseOS</SectionTitle>
        <Surface padding="p-5">
          <div className="text-[13.5px] text-ink-secondary">
            <p>WiseOS v0.1</p>
            <p className="mt-1">© {new Date().getFullYear()} Wisecast AB</p>
            <p className="mt-3 text-[12px] text-ink-muted">
              AI-driven rättningsassistent för svenska STEM-lärare
            </p>
          </div>
        </Surface>
      </section>

      {/* Session */}
      <section>
        <SectionTitle>Session</SectionTitle>
        <Surface padding="p-5">
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full rounded-[10px] border border-ink-hairline bg-paper-elevated px-5 py-2.5 text-[13px] font-medium text-red-600 transition-all hover:bg-red-50 hover:text-red-700 active:scale-[0.98] disabled:opacity-50"
          >
            {isLoggingOut ? "Loggar ut..." : "Logga ut"}
          </button>
        </Surface>
      </section>
    </div>
  );
}
