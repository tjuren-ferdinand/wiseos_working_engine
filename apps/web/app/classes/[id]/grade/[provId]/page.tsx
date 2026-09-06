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
      <div className={`text-center py-20 ${isDark ? "text-paper/50" : "text-ink-secondary"}`}>
        Provet kunde inte hittas. <Link href={`/`} className="text-[#e8b0e4] underline">Till klasslistan</Link>
      </div>
    );
  }

  // Workbench mode
  if (studentId) {
    const result = allResults.find((r) => r.id === studentId);
    if (!result) return <div className="text-center py-20 text-ink-secondary">Elev saknas.</div>;
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
  if (prov.status === "grading") {
    return (
      <div className="-mx-5 -mt-6 flex min-h-[calc(100vh-8rem)] items-center justify-center px-5">
        <div className="w-full max-w-2xl">
          <ProcessingScene prov={prov} klass={klass} onBack={() => router.push(`/classes/${klass.id}`)} />
        </div>
      </div>
    );
  }

  // Folder grid
  return (
    <div className="space-y-8 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/classes/${klass.id}`} className={`text-sm transition-colors ${isDark ? "text-paper/50 hover:text-paper" : "text-ink-secondary hover:text-ink"}`}>← {klass.name}</Link>
          <h1 className={`mt-3 text-[40px] font-bold tracking-[-0.02em] text-ink`}>{prov.title}</h1>
          <div className={`mt-2 text-sm ${isDark ? "text-paper/50" : "text-ink-secondary"}`}>
            Klassmapp · {allResults.length} elever rättade
          </div>
        </div>
      </div>

      {allResults.length === 0 ? (
        <div className={`rounded-2xl border-2 border-dashed p-12 text-center ${isDark ? "border-paper-raised/10 bg-paper-raised/5 text-paper/50" : "border-ink-hairline bg-paper-raised text-ink-secondary"}`}>
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
                    ? "border-paper-raised/10 bg-paper-raised/5 hover:bg-paper-raised/10 hover:border-paper-raised/20" 
                    : "border-ink-hairline/70 bg-paper-raised shadow-sm hover:border-[#e8b0e4]/40 hover:shadow-lg"
                }`}
              >
                {needsAttention && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold text-state-warning bg-state-warning/10 ring-1 ring-state-warning/20 rounded-full px-2 py-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-state-warning" />
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
                    <div className={`text-sm font-semibold truncate ${isDark ? "text-ink group-hover:text-[#e8b0e4]" : "text-ink group-hover:text-[#c78bbf]"}`}>
                      {r.studentName}
                    </div>
                    <div className={`text-xs ${isDark ? "text-ink-muted" : "text-ink-secondary"}`}>{r.steps.length} steg</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className={`text-xs ${isDark ? "text-ink-muted" : "text-ink-secondary"}`}>Poäng</span>
                    <span className={`font-mono text-sm font-semibold tabular-nums ${isDark ? "text-paper" : "text-ink"}`}>
                      {total}<span className={isDark ? "text-paper/30" : "text-ink-muted"}>/{max}</span>
                    </span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-paper-raised/10" : "bg-paper-secondary"}`}>
                    <div
                      className={`h-full transition-all ${
                        pct >= 0.85 ? "bg-state-success"
                        : pct >= 0.5 ? "bg-state-warning"
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
