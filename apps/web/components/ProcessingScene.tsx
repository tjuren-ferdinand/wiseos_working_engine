"use client";

import { useState, useEffect } from "react";
import type { Prov } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import LineIcon from "./LineIcon";

type PhaseIcon = "upload" | "folder" | "file" | "sigma" | "check" | "pen";

const PHASES = [
  {
    key: "uploading",
    title: "Laddar upp till wiseOS",
    desc: "Säker överföring av elevernas inlämningar till backend-pipelinen.",
    icon: "upload" as PhaseIcon,
  },
  {
    key: "sectioning",
    title: "Sektionerar provbunten",
    desc: "Identifierar varje elevs sidor och bygger en personlig mapp.",
    icon: "folder" as PhaseIcon,
  },
  {
    key: "ocr",
    title: "OCR – extraherar text och formler",
    desc: "Mathpix-pipeline tolkar handstil och bygger LaTeX-representationer.",
    icon: "file" as PhaseIcon,
  },
  {
    key: "verifying",
    title: "Verifierar matematiken via Wolfram|Alpha",
    desc: "Kör steg-för-steg-kontroll mot facit, hittar algebraiska ekvivalenser.",
    icon: "sigma" as PhaseIcon,
  },
  {
    key: "feedback",
    title: "Genererar pedagogisk feedback",
    desc: "WiseOS genererar varm, konkret feedback per uppgift och elev.",
    icon: "check" as PhaseIcon,
  },
  {
    key: "overlay_generation",
    title: "Förbereder visuellt overlay",
    desc: "Ritar digitala anteckningar ovanpå elevens handskrivna ark.",
    icon: "pen" as PhaseIcon,
  },
] as const;

export default function ProcessingScene({ prov }: { prov: Prov }) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  
  // Självanimerande: kör igenom faser lokalt
  const [currentIdx, setCurrentIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    // Animera genom alla faser
    const interval = setInterval(() => {
      setCurrentIdx((prev) => {
        if (prev < PHASES.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1800); // 1.8s per fas
    
    // Smooth progress animation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const target = (currentIdx + 1) / PHASES.length;
        if (prev < target) {
          return Math.min(prev + 0.02, target);
        }
        return prev;
      });
    }, 50);
    
    return () => {
      clearInterval(interval);
      clearInterval(progressInterval);
    };
  }, [currentIdx]);
  
  const isError = false;
  const isDone = currentIdx >= PHASES.length - 1 && progress >= 0.95;

  return (
    <div className={`rounded-2xl p-8 sm:p-10 overflow-hidden relative ${
      isDark
        ? "bg-paper-raised/5 border border-paper-raised/10"
        : "bg-paper-raised border border-ink-hairline shadow-soft"
    }`}>
      <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 h-[300px] w-[600px] rounded-full bg-paper-secondary/10 blur-[100px]" />

      <div className="relative">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-3 w-3 rounded-full bg-paper-secondary" />
            <div className="absolute inset-0 h-3 w-3 rounded-full bg-paper-secondary animate-ping" />
          </div>
          <span className={`text-xs font-semibold uppercase tracking-[0.1em] ${isDark ? "text-ink-muted" : "text-ink-secondary"}`}>
            wiseOS arbetar
          </span>
        </div>
        <h2 className={`mt-4 text-2xl sm:text-3xl font-semibold tracking-tight ${isDark ? "text-paper" : "text-ink"}`}>
          Rättar &quot;{prov.title}&quot;
        </h2>
        <p className={`mt-2 text-sm max-w-xl ${isError ? "text-rose-400" : isDark ? "text-ink-secondary" : "text-ink-secondary"}`}>
          {isError
            ? "Något gick fel när vi kontaktade backend-pipelinen. Kontrollera att API-tjänsten körs på :8000 och försök igen."
            : "Detta tar normalt 20–40 sekunder per elev. Du kan lämna fönstret öppet – vi sparar löpande."}
        </p>

        {/* Phase grid */}
        <div className="mt-8 grid gap-3 md:grid-cols-3">
          {PHASES.map((p, i) => {
            const active = i === currentIdx && !isError;
            const done = isDone || (currentIdx >= 0 && i < currentIdx);
            return (
              <div
                key={p.key}
                className={`relative rounded-xl border p-4 transition-all duration-500 ${
                  active
                    ? isDark
                      ? "border-ink-hairline/40 bg-paper-secondary/10 -translate-y-0.5"
                      : "border-ink-hairline bg-paper-secondary/50 shadow-sm -translate-y-0.5"
                    : done
                    ? isDark
                      ? "border-state-success/30 bg-state-success/10"
                      : "border-state-success/20 bg-state-success/10/40"
                    : isDark
                    ? "border-paper-raised/10 bg-paper-raised/5 opacity-50"
                    : "border-ink-hairline bg-paper-raised/60 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`h-8 w-8 grid place-items-center rounded-lg text-base font-semibold ${
                      done 
                        ? "bg-state-success text-paper" 
                        : active 
                        ? isDark ? "bg-paper-secondary text-ink" : "bg-paper-secondary text-ink"
                        : isDark ? "bg-paper-raised/10 text-paper/50" : "bg-paper-secondary text-ink-secondary"
                    }`}
                  >
                    {done ? <LineIcon name="check" className="h-4 w-4" /> : <LineIcon name={p.icon} className="h-4 w-4" />}
                  </div>
                  {active && (
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-paper-secondary animate-bounce [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-paper-secondary animate-bounce [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-paper-secondary animate-bounce" />
                    </div>
                  )}
                </div>
                <div className={`mt-3 font-semibold text-[14px] leading-tight ${isDark ? "text-paper" : "text-ink"}`}>
                  {p.title}
                </div>
                <div className={`mt-1 text-xs leading-relaxed ${isDark ? "text-paper/50" : "text-ink-secondary"}`}>
                  {p.desc}
                </div>
              </div>
            );
          })}
        </div>

        {/* Linear progress */}
        <div className="mt-8">
          <div className={`flex items-center justify-between text-xs mb-2 ${isDark ? "text-paper/50" : "text-ink-secondary"}`}>
            <span>Total progress</span>
            <span className={`font-mono font-medium ${isDark ? "text-paper" : "text-ink"}`}>
              {Math.round(progress * 100)}%
            </span>
          </div>
          <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? "bg-paper-raised/10" : "bg-paper-secondary"}`}>
            <div
              className="h-full bg-gradient-to-r from-ink to-ink transition-all duration-700 ease-out"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
