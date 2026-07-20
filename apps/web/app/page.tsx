"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";

export default function DashboardPage() {
  const klasser = useStore((s) => s.klasser);
  const prov = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const kurser = useStore((s) => s.kurser);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Metrics
  const pendingReviews = prov.filter((p) => p.status === "review" || p.status === "grading").length;
  const publishedProvIds = prov.filter((p) => p.status === "published").map((p) => p.id);
  const completedThisWeek = results.filter((r) => publishedProvIds.includes(r.provId)).length;
  const totalStudents = results.length;
  
  // Calculate time saved (estimate: 3 min per student graded)
  const minutesSaved = completedThisWeek * 3;
  const hoursSaved = Math.floor(minutesSaved / 60);
  const remainingMinutes = minutesSaved % 60;

  // Get recent activity
  const recentResults = results.slice(-3).reverse();

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-8 py-12">
        
        {/* Header - Minimal, purposeful */}
        <header className="mb-16">
          <h1 className={`text-[32px] font-semibold tracking-[-0.02em] ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
            God eftermiddag
          </h1>
          <p className={`mt-2 text-[17px] ${isDark ? "text-white/50" : "text-[#6E6E73]"}`}>
            Här är en översikt av din rättningsstatus.
          </p>
        </header>

        {/* Primary Action Card - The ONE thing that needs attention */}
        {pendingReviews > 0 && (
          <section className="mb-12">
            <div className={`rounded-[24px] p-8 ${
              isDark 
                ? "bg-[#1a1a1a] border border-white/[0.08]" 
                : "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)]"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                    <span className="text-[13px] font-medium uppercase tracking-wider text-[#F59E0B]">
                      Kräver uppmärksamhet
                    </span>
                  </div>
                  <h2 className={`text-[28px] font-semibold tracking-[-0.02em] ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
                    {pendingReviews} {pendingReviews === 1 ? "prov väntar" : "prov väntar"} på granskning
                  </h2>
                  <p className={`mt-2 text-[15px] ${isDark ? "text-white/50" : "text-[#6E6E73]"}`}>
                    AI har förberett bedömningar. Granska och godkänn för att publicera.
                  </p>
                </div>
                <Link
                  href="/review"
                  className="shrink-0 inline-flex items-center gap-2 px-6 py-3 rounded-[12px] text-[15px] font-semibold bg-[#1D1D1F] text-white hover:bg-[#2d2d2f] transition-colors"
                >
                  Granska nu
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Metrics Grid - Answer the key questions */}
        <section className="mb-12">
          <div className="grid grid-cols-3 gap-4">
            {/* Time Saved - Hero metric */}
            <div className={`col-span-2 rounded-[24px] p-8 ${
              isDark 
                ? "bg-[#1a1a1a] border border-white/[0.08]" 
                : "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)]"
            }`}>
              <div className={`text-[13px] font-medium uppercase tracking-wider mb-4 ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                Tid sparad denna vecka
              </div>
              <div className="flex items-baseline gap-3">
                <span className={`text-[64px] font-semibold tracking-[-0.03em] leading-none ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
                  {hoursSaved > 0 ? hoursSaved : minutesSaved}
                </span>
                <span className={`text-[24px] font-medium ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                  {hoursSaved > 0 ? (hoursSaved === 1 ? "timme" : "timmar") : "min"}
                </span>
                {hoursSaved > 0 && remainingMinutes > 0 && (
                  <span className={`text-[24px] font-medium ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                    {remainingMinutes} min
                  </span>
                )}
              </div>
              <div className={`mt-4 flex items-center gap-2 text-[14px] ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                <svg className="w-4 h-4 text-[#22C55E]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {completedThisWeek} elevprov rättade med AI-assistans
              </div>
            </div>

            {/* Completion status */}
            <div className={`rounded-[24px] p-8 ${
              isDark 
                ? "bg-[#1a1a1a] border border-white/[0.08]" 
                : "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.04)]"
            }`}>
              <div className={`text-[13px] font-medium uppercase tracking-wider mb-4 ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                Status
              </div>
              <div className={`text-[48px] font-semibold tracking-[-0.03em] leading-none ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
                {totalStudents > 0 ? Math.round((completedThisWeek / totalStudents) * 100) : 0}%
              </div>
              <div className={`mt-3 text-[14px] ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                publicerade
              </div>
              {/* Progress bar */}
              <div className={`mt-4 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-[#E5E5E7]"}`}>
                <div 
                  className="h-full rounded-full bg-[#22C55E] transition-all duration-500"
                  style={{ width: `${totalStudents > 0 ? (completedThisWeek / totalStudents) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-5 gap-6">
          
          {/* Classes - Main content */}
          <section className="col-span-3">
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-[15px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                Klasser
              </h2>
              <Link
                href="/classes/new"
                className="text-[14px] font-medium text-[#e8b0e4] hover:text-[#d89dd3] transition-colors"
              >
                + Ny klass
              </Link>
            </div>

            <div className="space-y-3">
              {klasser.length === 0 ? (
                <div className={`rounded-[16px] border-2 border-dashed p-10 text-center ${
                  isDark ? "border-white/10" : "border-[#E5E5E7]"
                }`}>
                  <div className={`text-[15px] font-medium ${isDark ? "text-white/60" : "text-[#6E6E73]"}`}>
                    Inga klasser ännu
                  </div>
                  <Link
                    href="/classes/new"
                    className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[14px] font-semibold bg-[#e8b0e4] text-[#1D1D1F] hover:bg-[#d89dd3] transition-colors"
                  >
                    Skapa din första klass
                  </Link>
                </div>
              ) : (
                klasser.map((k) => {
                  const klassProv = prov.filter((p) => p.klassId === k.id);
                  const kurs = kurser.find((c) => c.id === k.kursId);
                  const pendingInClass = klassProv.filter((p) => p.status !== "published").length;

                  return (
                    <Link
                      key={k.id}
                      href={`/classes/${k.id}`}
                      className={`block rounded-[16px] p-5 transition-all ${
                        isDark
                          ? "bg-[#1a1a1a] border border-white/[0.08] hover:border-white/[0.15]"
                          : "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center text-[15px] font-semibold ${
                            isDark ? "bg-[#e8b0e4]/15 text-[#e8b0e4]" : "bg-[#e8b0e4]/15 text-[#c78bbf]"
                          }`}>
                            {k.name.slice(0, 2)}
                          </div>
                          <div>
                            <div className={`text-[15px] font-semibold ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
                              {k.name}
                            </div>
                            <div className={`text-[13px] ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                              {(kurs?.name || "Kurs")} · {k.students.length} elever · {klassProv.length} prov
                            </div>
                          </div>
                        </div>
                        {pendingInClass > 0 && (
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F59E0B]/10 text-[#F59E0B] text-[12px] font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                            {pendingInClass} väntar
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>

          {/* Sidebar - Recent Activity */}
          <aside className="col-span-2">
            <h2 className={`text-[15px] font-semibold uppercase tracking-wider mb-6 ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
              Senaste aktivitet
            </h2>

            <div className={`rounded-[16px] overflow-hidden ${
              isDark 
                ? "bg-[#1a1a1a] border border-white/[0.08]" 
                : "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            }`}>
              {recentResults.length === 0 ? (
                <div className={`p-6 text-center text-[14px] ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                  Ingen aktivitet ännu
                </div>
              ) : (
                <div className={`divide-y ${isDark ? "divide-white/[0.06]" : "divide-[#E5E5E7]"}`}>
                  {recentResults.map((result) => {
                    const resultProv = prov.find((p) => p.id === result.provId);
                    const totalPoints = result.steps.reduce((sum, step) => sum + step.earnedPoints, 0);
                    const maxPoints = result.steps.reduce((sum, step) => sum + step.maxPoints, 0);
                    const percentage = Math.round((totalPoints / maxPoints) * 100);

                    return (
                      <div key={result.id} className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-[14px] font-medium ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
                            {result.studentName}
                          </span>
                          <span className={`text-[13px] font-semibold ${
                            percentage >= 80 ? "text-[#22C55E]" : 
                            percentage >= 50 ? "text-[#F59E0B]" : "text-[#EF4444]"
                          }`}>
                            {totalPoints}/{maxPoints}
                          </span>
                        </div>
                        <div className={`text-[12px] ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                          {resultProv?.title || "Prov"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className={`mt-4 rounded-[16px] p-5 ${
              isDark 
                ? "bg-[#1a1a1a] border border-white/[0.08]" 
                : "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            }`}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className={`text-[24px] font-semibold ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
                    {klasser.length}
                  </div>
                  <div className={`text-[12px] ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                    Klasser
                  </div>
                </div>
                <div>
                  <div className={`text-[24px] font-semibold ${isDark ? "text-white" : "text-[#1D1D1F]"}`}>
                    {prov.length}
                  </div>
                  <div className={`text-[12px] ${isDark ? "text-white/40" : "text-[#6E6E73]"}`}>
                    Prov
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
