"use client";

import LineIcon from "@/components/LineIcon";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";

export default function CoursesPage() {
  const kurser = useStore((s) => s.kurser);
  const klasser = useStore((s) => s.klasser);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="space-y-12">
      <section className="pt-4">
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-[13px] font-semibold tracking-[0.2em] uppercase ${isDark ? "text-[#e8b0e4]" : "text-[#c78bbf]"}`}>
              Välj kurs
            </p>
            <h1 className={`mt-5 text-[48px] font-bold leading-[1.1] tracking-[-0.03em] ${isDark ? "text-white" : "text-slate-900"}`}>
              Kurser
            </h1>
            <p className={`mt-4 text-lg ${isDark ? "text-white/50" : "text-slate-500"}`}>
              Välj en kurs för att se dess klasser och prov.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {kurser.map((kurs) => {
          const kursKlasser = klasser.filter((k) => k.kursId === kurs.id);
          const totalStudents = kursKlasser.reduce((sum, k) => sum + k.students.length, 0);
          
          return (
            <Link
              key={kurs.id}
              href={`/courses/${kurs.id}`}
              className={`group relative rounded-3xl p-8 transition-all hover:-translate-y-1 ${
                isDark
                  ? "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
                  : "bg-white border border-slate-200/60 shadow-soft hover:shadow-card"
              }`}
            >
              <div className={`absolute right-6 top-6 transition-colors ${
                isDark ? "text-white/20 group-hover:text-[#e8b0e4]" : "text-slate-200 group-hover:text-[#c78bbf]"
              }`}>
                <LineIcon name="graduation-cap" className="h-8 w-8" />
              </div>
              
              <div className={`text-[11px] uppercase tracking-[0.08em] font-medium ${
                isDark ? "text-white/40" : "text-slate-400"
              }`}>
                {kurs.code}
              </div>
              
              <div className={`mt-2 text-2xl font-bold ${isDark ? "text-white" : "text-slate-900"}`}>
                {kurs.name}
              </div>
              
              <p className={`mt-3 text-sm leading-relaxed ${isDark ? "text-white/60" : "text-slate-600"}`}>
                {kurs.description}
              </p>
              
              <div className={`mt-6 flex items-center gap-6 text-sm ${isDark ? "text-white/50" : "text-slate-500"}`}>
                <span className="flex items-center gap-2">
                  <LineIcon name="users" className="h-4 w-4" />
                  {kursKlasser.length} {kursKlasser.length === 1 ? "klass" : "klasser"}
                </span>
                <span className="flex items-center gap-2">
                  <LineIcon name="users" className="h-4 w-4" />
                  {totalStudents} elever
                </span>
              </div>
              
              {kurs.gradeThresholds && (
                <div className={`mt-4 pt-4 border-t ${isDark ? "border-white/10" : "border-slate-200"}`}>
                  <div className={`text-xs ${isDark ? "text-white/40" : "text-slate-400"}`}>
                    Betygsgränser
                  </div>
                  <div className={`mt-2 flex items-center gap-2 text-xs font-medium ${isDark ? "text-white/60" : "text-slate-600"}`}>
                    <span>A: {kurs.gradeThresholds.A}%</span>
                    <span>·</span>
                    <span>C: {kurs.gradeThresholds.C}%</span>
                    <span>·</span>
                    <span>E: {kurs.gradeThresholds.E}%</span>
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
