"use client";

import LineIcon from "@/components/LineIcon";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";

export default function ClassesPage() {
  const klasser = useStore((s) => s.klasser);
  const prov = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const kurser = useStore((s) => s.kurser);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="space-y-12">
      <section className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-[13px] font-semibold tracking-[0.2em] uppercase ${isDark ? "text-[#e8b0e4]" : "text-[#c78bbf]"}`}>
              Hantera
            </p>
            <h1 className={`mt-5 text-[48px] font-bold leading-[1.1] tracking-[-0.03em] ${isDark ? "text-white" : "text-slate-900"}`}>
              Klasser
            </h1>
            <p className={`mt-4 text-lg ${isDark ? "text-white/50" : "text-slate-500"}`}>
              Hantera dina klasser och rättningsparametrar.
            </p>
          </div>
          <Link
            href="/classes/new"
            className="mt-8 inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl text-[15px] font-semibold bg-[#e8b0e4] text-slate-900 hover:bg-[#d89dd3] transition-all duration-200 active:scale-[0.98]"
          >
            + Skapa klass
          </Link>
        </div>
      </section>

      {klasser.length === 0 ? (
        <div className={`rounded-2xl border-2 border-dashed p-16 text-center ${
          isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
        }`}>
          <div className={`mx-auto h-14 w-14 rounded-2xl grid place-items-center ${
            isDark ? "bg-[#e8b0e4]/10" : "bg-[#e8b0e4]/15"
          }`}>
            <LineIcon name="graduation-cap" className={`h-7 w-7 ${isDark ? "text-[#e8b0e4]" : "text-[#c78bbf]"}`} />
          </div>
          <h3 className={`mt-5 text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
            Inga klasser ännu
          </h3>
          <p className={`mt-2 text-sm ${isDark ? "text-white/50" : "text-slate-500"}`}>
            Skapa din första klass för att börja rätta.
          </p>
          <Link
            href="/classes/new"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-[#e8b0e4] text-slate-900 hover:bg-[#d89dd3] transition-all duration-200"
          >
            Kom igång
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {klasser.map((k) => {
            const klassProv = prov.filter((p) => p.klassId === k.id);
            const klassResults = results.filter((r) =>
              klassProv.some((p) => p.id === r.provId),
            );
            const kurs = kurser.find((c) => c.id === k.kursId);
            return (
              <Link
                key={k.id}
                href={`/classes/${k.id}`}
                className={`group relative rounded-2xl p-5 transition-all hover:-translate-y-0.5 ${
                  isDark
                    ? "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
                    : "bg-white border border-slate-200/60 shadow-soft hover:shadow-card"
                }`}
              >
                <div className={`absolute right-4 top-4 transition-colors ${
                  isDark ? "text-white/20 group-hover:text-[#e8b0e4]" : "text-slate-200 group-hover:text-[#c78bbf]"
                }`}>
                  <LineIcon name="graduation-cap" className="h-6 w-6" />
                </div>
                <div className={`text-[11px] uppercase tracking-[0.08em] font-medium ${
                  isDark ? "text-white/40" : "text-slate-400"
                }`}>
                  {kurs?.name || "Kurs"} · {k.students.length} elever
                </div>
                <div className={`mt-1 text-base font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                  {k.name}
                </div>
                {k.gradingParams.customRules.length > 0 && (
                  <div className={`mt-3 line-clamp-2 text-xs leading-relaxed italic ${
                    isDark ? "text-white/40" : "text-slate-500"
                  }`}>
                    &ldquo;{k.gradingParams.customRules[0]}&rdquo;
                  </div>
                )}
                <div className={`mt-4 flex items-center gap-4 text-sm ${isDark ? "text-white/50" : "text-slate-500"}`}>
                  <span className="flex items-center gap-1.5">
                    <LineIcon name="users" className="h-4 w-4" />
                    {klassResults.length} elever
                  </span>
                  <span>{klassProv.length} prov</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
