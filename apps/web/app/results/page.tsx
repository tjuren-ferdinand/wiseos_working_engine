"use client";

import LineIcon from "@/components/LineIcon";
import Link from "next/link";
import { useStore, deriveStep } from "@/lib/store";
import { useTheme } from "@/lib/theme";

export default function ResultsPage() {
  const results = useStore((s) => s.results);
  const prov = useStore((s) => s.prov);
  const klasser = useStore((s) => s.klasser);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const publishedResults = results.filter((r) => r.isPublished);

  return (
    <div className="space-y-12">
      <section className="pt-4">
        <p className={`text-[13px] font-semibold tracking-[0.2em] uppercase ${isDark ? "text-[#e8b0e4]" : "text-[#c78bbf]"}`}>
          Översikt
        </p>
        <h1 className={`mt-5 text-[48px] font-bold leading-[1.1] tracking-[-0.03em] ${isDark ? "text-white" : "text-slate-900"}`}>
          Resultat
        </h1>
        <p className={`mt-4 text-lg ${isDark ? "text-white/50" : "text-slate-500"}`}>
          Publicerade resultat för dina elever.
        </p>
      </section>

      {publishedResults.length === 0 ? (
        <div className={`rounded-2xl border-2 border-dashed p-16 text-center ${
          isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
        }`}>
          <div className={`mx-auto h-14 w-14 rounded-2xl grid place-items-center ${
            isDark ? "bg-[#e8b0e4]/10" : "bg-[#e8b0e4]/15"
          }`}>
            <LineIcon name="chart" className={`h-7 w-7 ${isDark ? "text-[#e8b0e4]" : "text-[#c78bbf]"}`} />
          </div>
          <h3 className={`mt-5 text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
            Inga publicerade resultat
          </h3>
          <p className={`mt-2 text-sm ${isDark ? "text-white/50" : "text-slate-500"}`}>
            Rätta och publicera prov för att se resultat här.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {publishedResults.map((r) => {
            const provData = prov.find((p) => p.id === r.provId);
            const klass = klasser.find((k) => k.id === provData?.klassId);
            const totalPoints = r.steps.reduce((sum, s) => {
              const d = deriveStep(s);
              return sum + d.displayedPoints;
            }, 0);
            const maxPoints = r.steps.reduce((sum, s) => sum + s.pointsMax, 0);
            
            return (
              <div
                key={r.id}
                className={`rounded-2xl p-5 ${
                  isDark
                    ? "bg-white/5 border border-white/10"
                    : "bg-white border border-slate-200/60 shadow-soft"
                }`}
              >
                <div className={`text-[11px] uppercase tracking-[0.08em] font-medium ${
                  isDark ? "text-white/40" : "text-slate-400"
                }`}>
                  {klass?.name || "Okänd klass"} · {provData?.title || "Okänt prov"}
                </div>
                <div className={`mt-1 text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {r.studentName}
                </div>
                <div className={`mt-3 text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {totalPoints}/{maxPoints}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
