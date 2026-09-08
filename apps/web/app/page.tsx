"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import Reveal from "@/components/Reveal";
import { createClient } from "@/lib/supabase/client";
import Onboarding from "@/components/Onboarding";
import DashboardEmptyState from "@/components/DashboardEmptyState";
import GradingGrid from "@/components/GradingGrid";

export default function DashboardPage() {
  const klasser = useStore((s) => s.klasser);
  const prov = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const kurser = useStore((s) => s.kurser);

  // Metrics
  const pendingReviews = prov.filter((p) => p.status === "review").length;
  const aiGradedProv = prov.filter((p) => p.status === "review" || p.status === "published").length;
  const publishedProvIds = prov.filter((p) => p.status === "published").map((p) => p.id);
  const completedThisWeek = results.filter((r) => publishedProvIds.includes(r.provId)).length;
  const totalStudents = results.length;
  
  // Calculate time saved (estimate: 3 min per student graded)
  const minutesSaved = completedThisWeek * 3;
  const hoursSaved = Math.floor(minutesSaved / 60);
  const remainingMinutes = minutesSaved % 60;

  // Get recent activity
  const recentResults = results.slice(-3).reverse();

  const ink = "text-ink";
  const inkSecondary = "text-ink-secondary";
  const inkMuted = "text-ink-muted";
  const hairline = "border-ink-hairline";

  const [userName, setUserName] = useState("lärare");
  const [today, setToday] = useState("");

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const u = data.user;
        const name = (u?.user_metadata as Record<string, string> | undefined)?.name;
        const email = u?.email;
        setUserName(name || email?.split("@")[0] || "lärare");
      });

    const formatter = new Intl.DateTimeFormat("sv-SE", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    setToday(formatter.format(new Date()));
  }, []);

  return (
    <div className="pt-6 sm:pt-8">
      <Onboarding />
        {/* Greeting */}
        <Reveal>
          <div className="mb-14 sm:mb-16">
            <h1 className="break-words text-[28px] font-medium tracking-[-0.025em] text-ink sm:text-[32px]">
              Välkommen tillbaka, {userName}
            </h1>
            <p className="mt-2.5 text-[13.5px] text-ink-secondary">
              {today && <span className="capitalize">{today}</span>}
              {today && " · "}
              {pendingReviews > 0
                ? `${pendingReviews} prov väntar på granskning`
                : "Inga prov att granska just nu"}
            </p>
          </div>
        </Reveal>

        {/* Metrics — integrated information row, not boxed widgets */}
        <Reveal>
          <div className="mb-10 w-full border-y border-ink-hairline sm:mb-12">
            <div className="grid grid-cols-1 sm:grid-cols-3">
              {[
                {
                  label: "Tid sparad",
                  value: hoursSaved > 0 ? hoursSaved : minutesSaved,
                  unit: hoursSaved > 0 ? (hoursSaved === 1 ? "timme" : "timmar") : "min",
                  sub: "den här veckan",
                },
                {
                  label: "Publicerade resultat",
                  value: `${totalStudents > 0 ? Math.round((completedThisWeek / totalStudents) * 100) : 0}%`,
                  sub: `av totalt ${totalStudents}`,
                },
                {
                  label: "AI-rättade prov",
                  value: String(aiGradedProv),
                  sub: "denna vecka",
                },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className={`flex min-h-[132px] min-w-0 flex-col justify-center px-1 py-7 sm:px-7 sm:py-8 sm:first:pl-0 sm:last:pr-0 ${
                    i < 2 ? "border-b border-ink-hairline sm:border-b-0 sm:border-r" : ""
                  }`}
                >
                  <div className={`text-[10.5px] font-medium uppercase tracking-[0.12em] ${inkMuted}`}>
                    {stat.label}
                  </div>
                  <div className="mt-2.5 flex min-h-9 items-baseline gap-1.5">
                    <span className={`text-[30px] font-medium leading-none tracking-[-0.025em] tabular-nums ${ink}`}>
                      {stat.value}
                    </span>
                    {stat.unit && <span className={`text-[12.5px] ${inkMuted}`}>{stat.unit}</span>}
                  </div>
                  <div className={`mt-2 text-[12.5px] leading-none ${inkMuted}`}>{stat.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Intelligent system notification — elevated surface, subtle accent, not an alert box */}
        {pendingReviews > 0 && (
          <Reveal delay={60}>
            <div className="relative mb-12 overflow-hidden rounded-2xl border border-ink-hairline bg-paper-elevated px-5 py-5 shadow-card sm:px-6 sm:py-6">
              <div className="pointer-events-none absolute inset-y-0 right-16 hidden w-48 text-ink opacity-[0.12] [mask-image:linear-gradient(to_right,transparent,black)] sm:block">
                <GradingGrid seed={814} compact />
              </div>
              <div className="relative z-10 flex items-center justify-between gap-6">
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_0_4px_rgb(var(--accent)/0.08)]" />
                  <div className="min-w-0">
                    <div className={`text-[10.5px] font-medium uppercase tracking-[0.12em] ${inkMuted}`}>
                      Redo för granskning
                    </div>
                    <h2 className={`mt-1.5 text-[16px] font-medium tracking-[-0.01em] ${ink}`}>
                      {pendingReviews} {pendingReviews === 1 ? "prov väntar" : "prov väntar"} på dig
                    </h2>
                    <p className={`mt-1 text-[13.5px] ${inkSecondary}`}>
                      WiseOS har förberett bedömningen.
                    </p>
                  </div>
                </div>
                <Link
                  href="/review"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 py-2.5 text-[13.5px] font-medium text-paper transition-all duration-300 hover:scale-[1.015] hover:bg-ink/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20 active:scale-[0.985]"
                >
                  Granska
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
          </Reveal>
        )}

        {/* Two column layout — quiet lists, generous spacing, hairline separators only */}
        <div className="grid grid-cols-1 gap-12 pb-10 lg:grid-cols-5 lg:gap-14">

          {/* Classes */}
          <Reveal className="col-span-1 lg:col-span-3" delay={120}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`text-[11px] font-medium uppercase tracking-[0.12em] ${inkMuted}`}>
                Klasser
              </h2>
              <Link href="/classes/new" className={`rounded-lg px-2 py-1 text-[13px] font-medium ${inkSecondary} transition-all duration-300 hover:bg-ink/[0.04] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15`}>
                + Ny klass
              </Link>
            </div>

            {klasser.length === 0 ? (
              <DashboardEmptyState />
            ) : (
              <div className={`border-t ${hairline}`}>
                {klasser.map((k) => {
                  const klassProv = prov.filter((p) => p.klassId === k.id);
                  const kurs = kurser.find((c) => c.id === k.kursId);
                  const pendingInClass = klassProv.filter((p) => p.status !== "published").length;

                  return (
                    <Link
                      key={k.id}
                      href={`/classes/${k.id}`}
                      className={`group -mx-2 flex min-w-0 items-center justify-between border-b px-2 py-4 ${hairline} rounded-lg transition-all duration-300 hover:bg-ink/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className={`text-[12.5px] font-medium w-8 tabular-nums ${inkMuted}`}>
                          {k.name.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <div className={`text-[14px] font-medium ${ink} truncate`}>{k.name}</div>
                          <div className={`text-[12.5px] ${inkMuted} truncate`}>
                            {(kurs?.name || k.kursId || "Kurs")} · {k.students.length} elever · {klassProv.length} prov
                          </div>
                        </div>
                      </div>
                      {pendingInClass > 0 && (
                        <span className={`text-[12px] font-medium ${inkSecondary} shrink-0 ml-2`}>
                          {pendingInClass} väntar
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </Reveal>

          {/* Recent activity */}
          <Reveal className="col-span-1 lg:col-span-2" delay={180}>
            <h2 className={`mb-4 text-[11px] font-medium uppercase tracking-[0.12em] ${inkMuted}`}>
              Senaste aktivitet
            </h2>

            {recentResults.length === 0 ? (
              <div className={`py-5 text-[13.5px] border-t ${hairline} ${inkSecondary}`}>
                Ingen aktivitet ännu
              </div>
            ) : (
              <div className={`border-t ${hairline}`}>
                {recentResults.map((result) => {
                  const resultProv = prov.find((p) => p.id === result.provId);
                  const totalPoints = result.steps.reduce((sum, step) => sum + step.earnedPoints, 0);
                  const maxPoints = result.steps.reduce((sum, step) => sum + step.maxPoints, 0);
                  const percentage = Math.round((totalPoints / maxPoints) * 100);

                  return (
                    <div key={result.id} className={`border-b py-4 ${hairline}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-[13.5px] font-medium ${ink}`}>{result.studentName}</span>
                        <span className={`text-[12.5px] font-medium tabular-nums ${
                          percentage >= 80 ? "text-state-success" :
                          percentage >= 50 ? inkSecondary :
                          "text-state-danger"
                        }`}>
                          {totalPoints}/{maxPoints}
                        </span>
                      </div>
                      <div className={`text-[12px] mt-0.5 ${inkMuted}`}>{resultProv?.title || "Prov"}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={`mt-4 flex items-center gap-6 text-[13px] ${inkSecondary}`}>
              <span><span className={`font-medium ${ink}`}>{klasser.length}</span> klasser</span>
              <span><span className={`font-medium ${ink}`}>{prov.length}</span> prov</span>
            </div>
          </Reveal>
        </div>
    </div>
  );
}
