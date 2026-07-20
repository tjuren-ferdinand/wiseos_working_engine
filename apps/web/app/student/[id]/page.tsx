"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useStore, deriveStep } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import LineIcon from "@/components/LineIcon";

export default function StudentProfilePage({ params }: { params: { id: string } }) {
  const results = useStore((s) => s.results);
  const prov = useStore((s) => s.prov);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Hämta ALLA resultat för denna elev
  const studentResults = useMemo(() => 
    results.filter((r) => r.studentId === params.id),
    [results, params.id]
  );

  const studentName = studentResults[0]?.studentName || "Okänd elev";

  // Beräkna statistik per prov
  const provStats = useMemo(() => {
    return studentResults.map((result) => {
      const provData = prov.find((p) => p.id === result.provId);
      const points = result.steps.reduce((sum, step) => {
        const derived = deriveStep(step);
        return sum + derived.displayedPoints;
      }, 0);
      const maxPoints = result.steps.reduce((sum, step) => sum + step.pointsMax, 0);
      const percentage = Math.round((points / maxPoints) * 100);
      
      return {
        result,
        provData,
        points,
        maxPoints,
        percentage,
        date: provData?.createdAt || result.provId,
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [studentResults, prov]);

  // Beräkna trend
  const trend = useMemo(() => {
    if (provStats.length < 2) return { direction: 'stable' as const, change: 0 };
    const first = provStats[0].percentage;
    const last = provStats[provStats.length - 1].percentage;
    const change = last - first;
    return {
      direction: change > 5 ? 'up' as const : change < -5 ? 'down' as const : 'stable' as const,
      change: Math.abs(change),
    };
  }, [provStats]);

  // Identifiera styrkor och svagheter
  const analysis = useMemo(() => {
    const allSteps = studentResults.flatMap((r) => r.steps);
    const stepsByLabel = new Map<string, { correct: number; total: number }>();
    
    allSteps.forEach((step) => {
      const existing = stepsByLabel.get(step.label) || { correct: 0, total: 0 };
      const derived = deriveStep(step);
      const isCorrect = derived.displayedPoints >= step.pointsMax * 0.8;
      stepsByLabel.set(step.label, {
        correct: existing.correct + (isCorrect ? 1 : 0),
        total: existing.total + 1,
      });
    });

    const topics = Array.from(stepsByLabel.entries()).map(([label, stats]) => ({
      label,
      successRate: Math.round((stats.correct / stats.total) * 100),
    }));

    return {
      strengths: topics.filter((t) => t.successRate >= 80).slice(0, 3),
      weaknesses: topics.filter((t) => t.successRate < 50).slice(0, 3),
    };
  }, [studentResults]);

  if (studentResults.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDark ? "bg-[#0a0a0a]" : "bg-[#F5F5F7]"}`}>
        <div className="text-center">
          <div className={`mx-auto h-16 w-16 rounded-2xl grid place-items-center mb-4 ${
            isDark ? "bg-white/10" : "bg-slate-100"
          }`}>
            <LineIcon name="users" className={`h-8 w-8 ${isDark ? "text-white/40" : "text-slate-400"}`} />
          </div>
          <h1 className={`text-2xl font-semibold mb-2 ${isDark ? "text-white" : "text-slate-900"}`}>
            Ingen data för denna elev
          </h1>
          <p className={isDark ? "text-white/50" : "text-slate-600"}>
            Det finns inga publicerade resultat ännu.
          </p>
          <Link href="/" className="mt-6 inline-block text-[#e8b0e4] hover:underline">
            ← Tillbaka till dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Avgör genomsnitt
  const avgPercentage = Math.round(
    provStats.reduce((sum, s) => sum + s.percentage, 0) / provStats.length
  );

  const getGrade = (percentage: number): string => {
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    if (percentage >= 50) return "E";
    return "F";
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case "A": return isDark ? "text-emerald-400 bg-emerald-500/20 border-emerald-500/30" : "text-green-600 bg-green-50 border-green-200";
      case "B": return isDark ? "text-emerald-400 bg-emerald-500/20 border-emerald-500/30" : "text-green-600 bg-green-50 border-green-200";
      case "C": return isDark ? "text-amber-400 bg-amber-500/20 border-amber-500/30" : "text-amber-600 bg-amber-50 border-amber-200";
      case "D": return isDark ? "text-amber-400 bg-amber-500/20 border-amber-500/30" : "text-amber-600 bg-amber-50 border-amber-200";
      case "E": return isDark ? "text-orange-400 bg-orange-500/20 border-orange-500/30" : "text-orange-600 bg-orange-50 border-orange-200";
      case "F": return isDark ? "text-red-400 bg-red-500/20 border-red-500/30" : "text-red-600 bg-red-50 border-red-200";
      default: return isDark ? "text-white/60 bg-white/10 border-white/20" : "text-slate-600 bg-slate-50 border-slate-200";
    }
  };

  // Använd första resultatets data för visning
  const currentStats = provStats[0];
  const grade = getGrade(avgPercentage);
  const gradeColorClass = getGradeColor(grade);

  // V2: Lärarvy - Elevprofil med alla prov
  return (
    <div className={`min-h-screen ${isDark ? "bg-[#0a0a0a]" : "bg-[#F5F5F7]"}`}>
      <div className="max-w-4xl mx-auto px-8 py-12">
        
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className={`text-sm ${isDark ? "text-white/50 hover:text-white" : "text-slate-500 hover:text-slate-700"}`}>
            ← Tillbaka
          </Link>
        </div>

        {/* Student Header */}
        <header className="mb-12">
          <h1 className={`text-[40px] font-bold tracking-[-0.02em] ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
            {studentName}
          </h1>
          <p className={`mt-2 text-[17px] ${isDark ? "text-white/50" : "text-[#6E6E73]"}`}>
            {provStats.length} prov · Genomsnitt {avgPercentage}%
          </p>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-12">
          {/* Average */}
          <div className={`rounded-[24px] p-6 ${isDark ? "bg-[#1a1a1a] border border-white/[0.08]" : "bg-white shadow-sm"}`}>
            <div className={`text-[13px] uppercase tracking-wider mb-2 ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
              Genomsnitt
            </div>
            <div className={`text-[48px] font-semibold ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
              {avgPercentage}%
            </div>
          </div>

          {/* Grade */}
          <div className={`rounded-[24px] p-6 ${isDark ? "bg-[#1a1a1a] border border-white/[0.08]" : "bg-white shadow-sm"}`}>
            <div className={`text-[13px] uppercase tracking-wider mb-2 ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
              Betyg
            </div>
            <div className={`text-[48px] font-semibold ${gradeColorClass} inline-block px-4 py-1 rounded-xl`}>
              {grade}
            </div>
          </div>

          {/* Trend */}
          <div className={`rounded-[24px] p-6 ${isDark ? "bg-[#1a1a1a] border border-white/[0.08]" : "bg-white shadow-sm"}`}>
            <div className={`text-[13px] uppercase tracking-wider mb-2 ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
              Trend
            </div>
            <div className={`text-[48px] font-semibold flex items-center gap-2 ${
              trend.direction === 'up' ? "text-emerald-500" :
              trend.direction === 'down' ? "text-red-500" :
              isDark ? "text-white/40" : "text-slate-400"
            }`}>
              {trend.direction === 'up' ? "↑" : trend.direction === 'down' ? "↓" : "→"}
              <span className="text-[24px]">{trend.change}%</span>
            </div>
          </div>
        </div>

        {/* All Tests */}
        <section>
          <h2 className={`text-[15px] font-semibold uppercase tracking-wider mb-6 ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
            Alla prov
          </h2>
          
          <div className="space-y-3">
            {provStats.map((stat) => (
              <div
                key={stat.result.id}
                className={`rounded-[16px] p-5 ${
                  isDark ? "bg-[#1a1a1a] border border-white/[0.08]" : "bg-white shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-[15px] font-semibold ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
                      {stat.provData?.title || "Prov"}
                    </div>
                    <div className={`text-[13px] mt-1 ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                      {stat.provData?.createdAt ? new Date(stat.provData.createdAt).toLocaleDateString("sv-SE") : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`text-[15px] ${isDark ? "text-white/60" : "text-slate-600"}`}>
                      {stat.points}/{stat.maxPoints} poäng
                    </div>
                    <span className={`px-3 py-1.5 rounded-lg text-[14px] font-semibold ${
                      stat.percentage >= 80 
                        ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                        : stat.percentage >= 50
                        ? isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-50 text-amber-700"
                        : isDark ? "bg-red-500/20 text-red-400" : "bg-red-50 text-red-700"
                    }`}>
                      {stat.percentage}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Strengths & Weaknesses */}
        {(analysis.strengths.length > 0 || analysis.weaknesses.length > 0) && (
          <section className="mt-12 grid grid-cols-2 gap-6">
            {analysis.strengths.length > 0 && (
              <div className={`rounded-[16px] p-5 ${isDark ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-emerald-50"}`}>
                <h3 className={`text-[14px] font-semibold mb-3 ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>
                  Styrkor
                </h3>
                <ul className="space-y-2">
                  {analysis.strengths.map((s) => (
                    <li key={s.label} className={`text-[13px] ${isDark ? "text-emerald-300" : "text-emerald-600"}`}>
                      {s.label} ({s.successRate}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {analysis.weaknesses.length > 0 && (
              <div className={`rounded-[16px] p-5 ${isDark ? "bg-red-500/10 border border-red-500/20" : "bg-red-50"}`}>
                <h3 className={`text-[14px] font-semibold mb-3 ${isDark ? "text-red-400" : "text-red-700"}`}>
                  Utvecklingsområden
                </h3>
                <ul className="space-y-2">
                  {analysis.weaknesses.map((w) => (
                    <li key={w.label} className={`text-[13px] ${isDark ? "text-red-300" : "text-red-600"}`}>
                      {w.label} ({w.successRate}%)
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
