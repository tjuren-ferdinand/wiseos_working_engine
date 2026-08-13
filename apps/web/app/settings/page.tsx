"use client";

import LineIcon from "@/components/LineIcon";
import { useTheme } from "@/lib/theme";
import { useOnboarding } from "@/components/Onboarding";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-[12px] font-medium uppercase tracking-[0.1em] text-ink-muted">
      {children}
    </h2>
  );
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { resetOnboarding } = useOnboarding();
  const isDark = theme === "dark";

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
        </Surface>
      </section>

      {/* Account */}
      <section>
        <SectionTitle>Konto</SectionTitle>
        <Surface padding="p-5">
          <div className="flex items-center gap-4">
            <div className="h-11 w-11 rounded-full grid place-items-center text-[15px] font-medium bg-ink/[0.05] border border-ink-hairline text-ink">
              A
            </div>
            <div>
              <div className="text-[14px] font-medium text-ink">Alexander</div>
              <div className="text-[12.5px] text-ink-muted">alexander@wiseos.se</div>
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
    </div>
  );
}
