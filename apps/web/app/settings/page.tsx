"use client";

import LineIcon from "@/components/LineIcon";
import { useTheme } from "@/lib/theme";
import { useOnboarding } from "@/components/Onboarding";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { resetOnboarding } = useOnboarding();
  const isDark = theme === "dark";

  return (
    <div className="space-y-12 max-w-2xl">
      <section className="pt-4">
        <p className={`text-[13px] font-semibold tracking-[0.2em] uppercase ${isDark ? "text-[#e8b0e4]" : "text-[#c78bbf]"}`}>
          Konfiguration
        </p>
        <h1 className={`mt-5 text-[48px] font-bold leading-[1.1] tracking-[-0.03em] ${isDark ? "text-white" : "text-slate-900"}`}>
          Inställningar
        </h1>
        <p className={`mt-4 text-lg ${isDark ? "text-white/50" : "text-slate-500"}`}>
          Anpassa wiseOS efter dina preferenser.
        </p>
      </section>

      {/* Theme Section */}
      <section>
        <h2 className={`text-[24px] font-bold tracking-[-0.02em] mb-6 ${isDark ? "text-white" : "text-slate-900"}`}>
          Utseende
        </h2>
        <div className={`rounded-2xl p-5 ${
          isDark
            ? "bg-white/5 border border-white/10"
            : "bg-white border border-slate-200/60 shadow-soft"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl grid place-items-center ${
                isDark ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                <LineIcon name={isDark ? "moon" : "sun"} className="h-5 w-5" />
              </div>
              <div>
                <div className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                  Tema
                </div>
                <div className={`text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}>
                  {isDark ? "Mörkt tema aktivt" : "Ljust tema aktivt"}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setTheme("light")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  theme === "light"
                    ? "bg-slate-900 text-white"
                    : isDark
                    ? "bg-white/10 text-white/70 hover:bg-white/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <LineIcon name="sun" className="h-4 w-4" />
                Ljust
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                  theme === "dark"
                    ? "bg-white text-slate-900"
                    : isDark
                    ? "bg-white/10 text-white/70 hover:bg-white/20"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <LineIcon name="moon" className="h-4 w-4" />
                Mörkt
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Account Section */}
      <section>
        <h2 className={`text-[24px] font-bold tracking-[-0.02em] mb-6 ${isDark ? "text-white" : "text-slate-900"}`}>
          Konto
        </h2>
        <div className={`rounded-2xl p-5 ${
          isDark
            ? "bg-white/5 border border-white/10"
            : "bg-white border border-slate-200/60 shadow-soft"
        }`}>
          <div className="flex items-center gap-4">
            <div className={`h-12 w-12 rounded-full grid place-items-center text-lg font-semibold ${
              isDark ? "bg-wise-300/20 text-wise-300" : "bg-wise-100 text-wise-600"
            }`}>
              A
            </div>
            <div>
              <div className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                Alexander
              </div>
              <div className={`text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}>
                alexander@wiseos.se
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Help Section */}
      <section>
        <h2 className={`text-[24px] font-bold tracking-[-0.02em] mb-6 ${isDark ? "text-white" : "text-slate-900"}`}>
          Hjälp & introduktion
        </h2>
        <div className={`rounded-2xl p-5 ${
          isDark
            ? "bg-white/5 border border-white/10"
            : "bg-white border border-slate-200/60 shadow-soft"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl grid place-items-center ${
                isDark ? "bg-white/10 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                <LineIcon name="play" className="h-5 w-5" />
              </div>
              <div>
                <div className={`text-sm font-medium ${isDark ? "text-white" : "text-slate-900"}`}>
                  Introduktion
                </div>
                <div className={`text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}>
                  Lär dig grunderna i WiseOS
                </div>
              </div>
            </div>
            <button
              onClick={resetOnboarding}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                isDark
                  ? "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              Starta onboarding igen
            </button>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section>
        <h2 className={`text-[24px] font-bold tracking-[-0.02em] mb-6 ${isDark ? "text-white" : "text-slate-900"}`}>
          Om wiseOS
        </h2>
        <div className={`rounded-2xl p-5 ${
          isDark
            ? "bg-white/5 border border-white/10"
            : "bg-white border border-slate-200/60 shadow-soft"
        }`}>
          <div className={`text-sm ${isDark ? "text-white/70" : "text-slate-600"}`}>
            <p>wiseOS v0.1</p>
            <p className="mt-1">© {new Date().getFullYear()} Wisecast AB</p>
            <p className={`mt-3 text-xs ${isDark ? "text-white/40" : "text-slate-400"}`}>
              AI-driven rättningsassistent för svenska STEM-lärare
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
