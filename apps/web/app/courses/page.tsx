"use client";

import LineIcon from "@/components/LineIcon";
import { useStore } from "@/lib/store";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";

export default function CoursesPage() {
  const kurser = useStore((s) => s.kurser);
  const klasser = useStore((s) => s.klasser);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Välj kurs"
        title="Kurser"
        subtitle="Välj en kurs för att se dess klasser och prov."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kurser.map((kurs) => {
          const kursKlasser = klasser.filter((k) => k.kursId === kurs.id);
          const totalStudents = kursKlasser.reduce((sum, k) => sum + k.students.length, 0);

          return (
            <Surface key={kurs.id} href={`/courses/${kurs.id}`} padding="p-6" className="relative">
              <div className="absolute right-5 top-5 text-ink-muted/50 transition-colors group-hover:text-ink-secondary">
                <LineIcon name="graduation-cap" className="h-5 w-5" />
              </div>

              <div className="text-[11px] uppercase tracking-[0.12em] font-medium text-ink-muted">
                {kurs.code}
              </div>
              <h2 className="mt-1.5 text-[17px] font-medium tracking-[-0.01em] text-ink">
                {kurs.name}
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary line-clamp-3">
                {kurs.description}
              </p>

              <div className="mt-5 flex items-center gap-5 text-[13px] text-ink-secondary">
                <span className="flex items-center gap-1.5">
                  <LineIcon name="users" className="h-3.5 w-3.5 opacity-70" />
                  {kursKlasser.length} {kursKlasser.length === 1 ? "klass" : "klasser"}
                </span>
                <span className="flex items-center gap-1.5">
                  <LineIcon name="users" className="h-3.5 w-3.5 opacity-70" />
                  {totalStudents} elever
                </span>
              </div>

              {kurs.gradeThresholds && (
                <div className="mt-4 pt-4 border-t border-ink-hairline">
                  <div className="text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                    Betygsgränser
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[12.5px] font-medium tabular-nums text-ink-secondary">
                    <span>A {kurs.gradeThresholds.A}%</span>
                    <span className="text-ink-muted">·</span>
                    <span>C {kurs.gradeThresholds.C}%</span>
                    <span className="text-ink-muted">·</span>
                    <span>E {kurs.gradeThresholds.E}%</span>
                  </div>
                </div>
              )}
            </Surface>
          );
        })}
      </div>
    </div>
  );
}
