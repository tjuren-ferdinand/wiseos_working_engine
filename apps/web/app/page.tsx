"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import Reveal from "@/components/Reveal";
import { createClient } from "@/lib/supabase/client";
import Onboarding from "@/components/Onboarding";
import DashboardEmptyState from "@/components/DashboardEmptyState";
import GradingGrid from "@/components/GradingGrid";
import Surface from "@/components/ui/Surface";

export default function DashboardPage() {
  const klasser = useStore((s) => s.klasser);
  const prov = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const kurser = useStore((s) => s.kurser);

  const pendingReviews = prov.filter((p) => p.status === "review").length;

  // Lärarens kurser: kurser som har minst en klass, plus egenskapade kurser.
  const activeKurser = kurser.filter(
    (kurs) => kurs.isCustom || klasser.some((k) => k.kursId === kurs.id)
  );

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

        {/* AI review card */}
        {pendingReviews > 0 && (
          <Reveal delay={60}>
            <div className="relative mb-12 overflow-hidden rounded-2xl border border-ink-hairline/10 bg-paper-elevated px-6 py-6 shadow-card">
              <div className="pointer-events-none absolute inset-y-0 right-20 hidden w-60 text-ink opacity-[0.10] [mask-image:linear-gradient(to_right,transparent,black)] sm:block">
                <GradingGrid seed={814} compact />
              </div>
              <div className="relative z-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_0_3px_rgb(var(--accent)/0.08)]" />
                  <div className="min-w-0">
                    <div className={`text-[10px] font-medium uppercase tracking-[0.12em] ${inkMuted}`}>
                      Redo för granskning
                    </div>
                    <h2 className={`mt-1.5 text-[18px] font-medium tracking-[-0.01em] ${ink}`}>
                      {pendingReviews} {pendingReviews === 1 ? "prov väntar" : "prov väntar"} på dig
                    </h2>
                    <p className={`mt-1 text-[13.5px] ${inkSecondary}`}>
                      WiseOS har förberett bedömningen. Du har sista ordet.
                    </p>
                  </div>
                </div>
                <Link
                  href="/review"
                  className="btn-primary shrink-0"
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

          {/* Courses */}
          <Reveal className="col-span-1 lg:col-span-3" delay={120}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`text-[11px] font-medium uppercase tracking-[0.12em] ${inkMuted}`}>
                Kurser
              </h2>
              <Link href="/courses" className={`btn-tertiary px-2 py-1 text-[13px]`}>
                + Ny kurs
              </Link>
            </div>

            {activeKurser.length === 0 ? (
              <DashboardEmptyState />
            ) : (
              <div className={`border-t ${hairline}`}>
                {activeKurser.map((kurs) => {
                  const kursKlasser = klasser.filter((k) => k.kursId === kurs.id);
                  const totalStudents = kursKlasser.reduce((sum, k) => sum + k.students.length, 0);
                  const pendingInKurs = kursKlasser.reduce(
                    (sum, k) => sum + prov.filter((p) => p.klassId === k.id && p.status !== "published").length,
                    0
                  );

                  return (
                    <Link
                      key={kurs.id}
                      href={`/courses/${kurs.id}`}
                      className={`group -mx-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 border-b px-2 py-4 ${hairline} rounded-xl transition-all duration-300 hover:bg-ink/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15`}
                    >
                      <span className={`w-10 text-[12.5px] font-medium tabular-nums ${inkMuted}`}>
                        {kurs.name.slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-[14px] font-medium ${ink} truncate`}>{kurs.name}</div>
                        <div className={`truncate text-[12px] ${inkMuted}`}>
                          {kurs.subject} · {kursKlasser.length} {kursKlasser.length === 1 ? "klass" : "klasser"} · {totalStudents} elever
                        </div>
                      </div>
                      {pendingInKurs > 0 ? (
                        <span className={`shrink-0 rounded-full bg-ink/[0.04] px-2.5 py-1 text-[11px] font-medium ${inkSecondary}`}>
                          {pendingInKurs} väntar
                        </span>
                      ) : (
                        <span className={`shrink-0 text-[11px] font-medium text-state-success`}>Klart</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </Reveal>

          {/* Classes + recent activity */}
          <Reveal className="col-span-1 lg:col-span-2" delay={180}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className={`text-[11px] font-medium uppercase tracking-[0.12em] ${inkMuted}`}>
                Klasser
              </h2>
              <Link href="/classes/new" className={`btn-tertiary px-2 py-1 text-[13px]`}>
                + Ny klass
              </Link>
            </div>

            {klasser.length === 0 ? (
              <div className={`border-t py-5 text-[13.5px] ${hairline} ${inkSecondary}`}>
                Inga klasser ännu — skapa en klass i en kurs.
              </div>
            ) : (
              <div className={`border-t ${hairline}`}>
                {klasser.map((k) => {
                  const klassProv = prov.filter((p) => p.klassId === k.id);
                  const pendingInClass = klassProv.filter((p) => p.status !== "published").length;

                  return (
                    <Link
                      key={k.id}
                      href={`/classes/${k.id}`}
                      className={`group -mx-2 grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b px-2 py-3.5 ${hairline} rounded-xl transition-all duration-300 hover:bg-ink/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/15`}
                    >
                      <span className={`w-8 text-[12px] font-medium tabular-nums ${inkMuted}`}>
                        {k.name.slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <div className={`text-[13.5px] font-medium ${ink} truncate`}>{k.name}</div>
                        <div className={`truncate text-[11.5px] ${inkMuted}`}>
                          {k.students.length} elever · {klassProv.length} prov
                        </div>
                      </div>
                      {pendingInClass > 0 ? (
                        <span className={`shrink-0 rounded-full bg-ink/[0.04] px-2 py-0.5 text-[11px] font-medium ${inkSecondary}`}>
                          {pendingInClass} väntar
                        </span>
                      ) : (
                        <span className={`shrink-0 text-[11px] font-medium text-state-success`}>Klart</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}

            <h2 className={`mb-4 mt-10 text-[11px] font-medium uppercase tracking-[0.12em] ${inkMuted}`}>
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
                  const percentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

                  return (
                    <div key={result.id} className={`border-b py-4 ${hairline}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-[13.5px] font-medium ${ink}`}>{result.studentName}</span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${
                          percentage >= 80
                            ? "bg-state-success/10 text-state-success"
                            : percentage >= 50
                            ? "bg-state-warning/10 text-state-warning"
                            : "bg-state-danger/10 text-state-danger"
                        }`}>
                          {totalPoints}/{maxPoints}
                        </span>
                      </div>
                      <div className={`mt-0.5 text-[12px] ${inkMuted}`}>{resultProv?.title || "Prov"}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={`mt-6 flex items-center gap-8 text-[12.5px] ${inkMuted}`}>
              <span><span className={`font-medium text-ink`}>{activeKurser.length}</span> kurser</span>
              <span><span className={`font-medium text-ink`}>{klasser.length}</span> klasser</span>
              <span><span className={`font-medium text-ink`}>{prov.length}</span> prov</span>
            </div>
          </Reveal>
        </div>
    </div>
  );
}
