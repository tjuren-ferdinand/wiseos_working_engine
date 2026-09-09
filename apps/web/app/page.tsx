"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import Reveal from "@/components/Reveal";
import { createClient } from "@/lib/supabase/client";
import Onboarding from "@/components/Onboarding";
import DashboardEmptyState from "@/components/DashboardEmptyState";

export default function DashboardPage() {
  const klasser = useStore((s) => s.klasser);
  const prov = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const kurser = useStore((s) => s.kurser);

  // Metrics
  const pendingReviews = prov.filter((p) => p.status === "review").length;

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
    <div className="pt-4">
      <Onboarding />
        {/* Greeting */}
        <Reveal>
          <div className="mb-20">
            <h1 className="text-[26px] font-medium tracking-[-0.02em] text-ink break-words">
              Välkommen tillbaka, {userName}
            </h1>
            <p className="mt-2 text-[13.5px] text-ink-secondary">
              {today && <span className="capitalize">{today}</span>}
              {today && " · "}
              {pendingReviews > 0
                ? `${pendingReviews} prov väntar på granskning`
                : "Inga prov att granska just nu"}
            </p>
          </div>
        </Reveal>

        {/* Intelligent system notification — elevated surface, subtle accent, not an alert box */}
        {pendingReviews > 0 && (
          <Reveal delay={60}>
            <div className="mb-8 flex items-center justify-between gap-6 rounded-[16px] bg-paper-elevated border border-ink-hairline shadow-card px-5 py-4">
              <div className="flex items-start gap-3.5">
                <span className="mt-1.5 h-[6px] w-[6px] rounded-full bg-ink shrink-0" />
                <div>
                  <div className={`text-[11px] font-medium uppercase tracking-[0.1em] ${inkMuted}`}>
                    Uppmärksamhet
                  </div>
                  <h2 className={`mt-1 text-[15.5px] font-medium ${ink}`}>
                    {pendingReviews} {pendingReviews === 1 ? "prov väntar" : "prov väntar"} på granskning
                  </h2>
                  <p className={`mt-0.5 text-[13.5px] ${inkSecondary}`}>
                    AI har förberett bedömningen.
                  </p>
                </div>
              </div>
              <Link
                href="/review"
                className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-[10px] text-[13.5px] font-medium bg-ink text-paper hover:bg-ink/90 transition-colors"
              >
                Granska
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </Reveal>
        )}

        {/* Two column layout — quiet lists, generous spacing, hairline separators only */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-12">

          {/* Classes */}
          <Reveal className="col-span-1 lg:col-span-3" delay={120}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-[12px] font-medium uppercase tracking-[0.1em] ${inkMuted}`}>
                Klasser
              </h2>
              <Link href="/classes/new" className={`text-[13px] font-medium ${inkSecondary} hover:text-ink transition-colors`}>
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
                      className={`group flex items-center justify-between py-3.5 border-b ${hairline} transition-colors hover:bg-ink/[0.02] -mx-1 px-1 min-w-0`}
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
            <h2 className={`text-[12px] font-medium uppercase tracking-[0.1em] mb-3 ${inkMuted}`}>
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
                    <div key={result.id} className={`py-3 border-b ${hairline}`}>
                      <div className="flex items-center justify-between">
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
