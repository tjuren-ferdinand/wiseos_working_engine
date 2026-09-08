"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { FlowStudent } from "./GradingFlowScene";
import s from "./GradingGrid.module.css";

const STUDENTS: FlowStudent[] = [
  { id: "demo-1", name: "Ella Andersson", status: "done", score: 18, maxScore: 20 },
  { id: "demo-2", name: "Noah Lind", status: "queued", score: 16, maxScore: 20 },
  { id: "demo-3", name: "Alma Berg", status: "queued", score: 19, maxScore: 20 },
  { id: "demo-4", name: "Liam Nilsson", status: "queued", score: 14, maxScore: 20 },
  { id: "demo-5", name: "Vera Holm", status: "done", score: 17, maxScore: 20 },
  { id: "demo-6", name: "Hugo Ek", status: "queued", score: 15, maxScore: 20 },
  { id: "demo-7", name: "Olivia Lund", status: "done", score: 18, maxScore: 20 },
  { id: "demo-8", name: "Leo Sjöberg", status: "queued", score: 16, maxScore: 20 },
];

export default function GradingGrid({
  className = "",
  seed = 42,
  compact = false,
}: {
  className?: string;
  seed?: number;
  compact?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [students, setStudents] = useState(STUDENTS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (compact) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () => setRunning(visible && !document.hidden && !media.matches);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    if (root.current) observer.observe(root.current);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [compact]);

  useEffect(() => {
    if (!running) {
      setStudents(STUDENTS);
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let snapshot = [...STUDENTS];
    let previous = -1;
    let randomState = Math.abs(seed) || 1;
    const random = () => {
      randomState = (randomState * 9301 + 49297) % 233280;
      return randomState / 233280;
    };
    const update = (index: number, status: FlowStudent["status"]) => {
      snapshot = snapshot.map((student, i) => i === index ? { ...student, status } : student);
      setStudents(snapshot);
    };
    const next = () => {
      const visible = snapshot.slice(0, window.matchMedia("(max-width: 480px)").matches ? 6 : 8);
      const queued = visible.flatMap((student, i) => student.status === "queued" ? [i] : []);
      const candidates = queued.length ? queued : visible.flatMap((_, i) => i === previous ? [] : [i]);
      const index = candidates[Math.floor(random() * candidates.length)];
      previous = index;
      update(index, "queued");
      timer = setTimeout(() => {
        update(index, "working");
        timer = setTimeout(() => {
          update(index, "done");
          timer = setTimeout(next, 1800 + random() * 1600);
        }, 3000);
      }, 800);
    };
    timer = setTimeout(next, 1500);
    return () => clearTimeout(timer);
  }, [running, seed]);

  const working = students.some((student) => student.status === "working");

  return (
    <div ref={root} className={`${s.canvas} ${compact ? s.compact : ""} ${className}`}>
      {!compact && (
        <div className={s.heading}>
          <span>Matematik 1c <span className={s.separator}>/</span> Klass NA24</span>
          <span className={s.example}>Exempelvy</span>
        </div>
      )}
      <div className={s.cards} aria-hidden="true">
        {students.map((student, index) => (
          <div
            key={student.id}
            className={s.card}
            data-state={student.status}
            style={{ "--depth": index % 3 === 1 ? "1" : "0.82" } as CSSProperties}
          >
            <div className={s.identity}>
              <span className={s.avatar}>
                {student.name.split(" ").map((name) => name[0]).join("")}
              </span>
              <svg className={s.statusIcon} viewBox="0 0 24 24" fill="none">
                <circle className={s.track} cx="12" cy="12" r="9" />
                <circle className={s.progress} cx="12" cy="12" r="9" pathLength="1" />
                <path className={s.check} d="m8 12 2.6 2.6 5.4-5.4" pathLength="1" />
              </svg>
            </div>
            <div className={s.name}>{student.name}</div>
            <div className={s.assessment}>
              <span className={s.waiting}>I kö</span>
              <span className={s.analyzing}>Analyserar lösning…</span>
              <span className={s.score}>{student.score}<span> / {student.maxScore} poäng</span></span>
            </div>
            <div className={s.edge} />
          </div>
        ))}
      </div>
      {!compact && (
        <div className={s.caption}>
          <span className={s.activity} data-working={working}><span />{working ? "WiseOS analyserar" : "Varje lösning får sin genomgång"}</span>
          <span className={s.control}>Du har sista ordet.</span>
        </div>
      )}
    </div>
  );
}
