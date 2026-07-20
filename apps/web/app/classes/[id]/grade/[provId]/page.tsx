"use client";

import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { useStore, deriveStep } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import ProcessingScene from "@/components/ProcessingScene";
import Workbench from "@/components/Workbench";
import PrintLayout from "@/components/PrintLayout";

export default function GradePage() {
  const params = useParams<{ id: string; provId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const studentId = search.get("student");

  const klasser = useStore((s) => s.klasser);
  const allProv = useStore((s) => s.prov);
  const results = useStore((s) => s.results);

  const { theme } = useTheme();
  const isDark = theme === "dark";

  const klass = useMemo(() => klasser.find((k) => k.id === params.id), [klasser, params.id]);
  const prov = useMemo(() => allProv.find((p) => p.id === params.provId), [allProv, params.provId]);
  const allResults = useMemo(() => results.filter((r) => r.provId === params.provId), [results, params.provId]);

  if (!klass || !prov) {
    return (
      <div className={`text-center py-20 ${isDark ? "text-white/50" : "text-slate-500"}`}>
        Provet kunde inte hittas. <Link href={`/`} className="text-[#e8b0e4] underline">Till klasslistan</Link>
      </div>
    );
  }

  // Workbench mode
  if (studentId) {
    const result = allResults.find((r) => r.id === studentId);
    if (!result) return <div className="text-center py-20 text-slate-500">Elev saknas.</div>;
    return (
      <>
        <Workbench
          result={result}
          prov={prov}
          klass={klass}
          onBack={() => router.push(`/classes/${klass.id}/grade/${prov.id}`)}
          onPrint={() => window.print()}
        />
        <PrintLayout klass={klass} prov={prov} result={result} />
      </>
    );
  }

  // Processing
  if (prov.status === "processing") {
    return (
      <div className="space-y-6">
        <Link href={`/classes/${klass.id}`} className="text-sm text-slate-500 hover:text-slate-800">← {klass.name}</Link>
        <ProcessingScene prov={prov} />
      </div>
    );
  }

  // Folder grid
  return (
    <div className="space-y-8 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/classes/${klass.id}`} className={`text-sm transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-slate-500 hover:text-slate-800"}`}>← {klass.name}</Link>
          <h1 className={`mt-3 text-[40px] font-bold tracking-[-0.02em] ${isDark ? "text-white" : "text-slate-900"}`}>{prov.title}</h1>
          <div className={`mt-2 text-sm ${isDark ? "text-white/50" : "text-slate-500"}`}>
            Klassmapp · {allResults.length} elever rättade
          </div>
        </div>
      </div>

      {allResults.length === 0 ? (
        <div className={`rounded-2xl border-2 border-dashed p-12 text-center ${isDark ? "border-white/10 bg-white/5 text-white/50" : "border-slate-200 bg-white text-slate-500"}`}>
          Inga resultat ännu.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {allResults.map((r) => {
            const total = r.steps.reduce(
              (s, st) => s + deriveStep(st, klass.gradingParams).earnedPoints,
              0,
            );
            const max = r.steps.reduce((s, st) => s + st.maxPoints, 0);
            const pct = max ? total / max : 0;
            const needsAttention = r.steps.some((st) => st.status !== "correct");
            return (
              <Link
                key={r.id}
                href={`/classes/${klass.id}/grade/${prov.id}?student=${r.id}`}
                className={`group rounded-2xl border p-5 hover:-translate-y-0.5 transition-all relative ${
                  isDark 
                    ? "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20" 
                    : "border-slate-200/70 bg-white shadow-sm hover:border-[#e8b0e4]/40 hover:shadow-lg"
                }`}
              >
                {needsAttention && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded-full px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Granska
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-full grid place-items-center font-serif text-lg font-semibold ${
                    isDark ? "bg-[#e8b0e4]/15 text-[#e8b0e4]" : "bg-[#e8b0e4]/20 text-[#9d6b99]"
                  }`}>
                    {r.studentName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-semibold truncate ${isDark ? "text-white group-hover:text-[#e8b0e4]" : "text-slate-900 group-hover:text-[#c78bbf]"}`}>
                      {r.studentName}
                    </div>
                    <div className={`text-xs ${isDark ? "text-white/40" : "text-slate-500"}`}>{r.steps.length} steg</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className={`text-xs ${isDark ? "text-white/40" : "text-slate-500"}`}>Poäng</span>
                    <span className={`font-mono text-sm font-semibold tabular-nums ${isDark ? "text-white" : "text-slate-900"}`}>
                      {total}<span className={isDark ? "text-white/30" : "text-slate-400"}>/{max}</span>
                    </span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-slate-100"}`}>
                    <div
                      className={`h-full transition-all ${
                        pct >= 0.85 ? "bg-emerald-500"
                        : pct >= 0.5 ? "bg-amber-500"
                        : "bg-rose-500"
                      }`}
                      style={{ width: `${pct * 100}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
