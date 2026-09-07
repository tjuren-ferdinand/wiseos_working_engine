"use client";

import { useState } from "react";
import LineIcon from "@/components/LineIcon";
import { actions, deriveSubject, useStore } from "@/lib/store";
import PageHeader from "@/components/ui/PageHeader";
import Surface from "@/components/ui/Surface";

export default function CoursesPage() {
  const kurser = useStore((s) => s.kurser);
  const klasser = useStore((s) => s.klasser);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", code: "", subject: "", level: "", description: "" });

  const createCourse = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await actions.createKurs({
        name: form.name.trim(),
        code: form.code.trim(),
        subject: form.subject.trim() || deriveSubject(form.name),
        level: form.level.trim() || undefined,
        description: form.description.trim(),
      });
      setForm({ name: "", code: "", subject: "", level: "", description: "" });
      setCreating(false);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteCourse = async (id: string) => {
    setError(null);
    try {
      await actions.deleteKurs(id);
      setConfirmDelete(null);
    } catch (cause) {
      const message = (cause as Error).message;
      setError(message.includes("409") ? "Ta bort kursens klasser först och försök sedan igen." : message);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Välj kurs"
        title="Kurser"
        subtitle="Välj en kurs för att se dess klasser och prov."
        action={
          <button type="button" onClick={() => setCreating((value) => !value)} className="btn-primary">
            {creating ? "Stäng" : "Skapa kurs"}
          </button>
        }
      />

      {creating && (
        <form onSubmit={createCourse} className="rounded-[16px] border border-ink-hairline bg-paper-raised p-6 shadow-soft">
          <div className="mb-5">
            <h2 className="text-[16px] font-medium text-ink">Ny kurs</h2>
            <p className="mt-1 text-[13px] text-ink-muted">Skapa en egen kurs som sparas på din profil.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-secondary">Kursnamn</span>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Exempelvis Matematik 1c HT26" required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-secondary">Kurskod</span>
              <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="MATMAT01c" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-secondary">Ämne</span>
              <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={deriveSubject(form.name || "Övrigt")} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] font-medium text-ink-secondary">Nivå</span>
              <input className="input" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="Gymnasiet" />
            </label>
          </div>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[12px] font-medium text-ink-secondary">Beskrivning</span>
            <textarea className="input min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Kort beskrivning av kursens upplägg och mål." />
          </label>
          <div className="mt-5 flex items-center justify-between gap-4">
            <span className="text-[12.5px] text-state-danger">{error}</span>
            <button type="submit" disabled={submitting || !form.name.trim()} className="btn-primary disabled:opacity-50">
              {submitting ? "Skapar…" : "Skapa kurs"}
            </button>
          </div>
        </form>
      )}

      {!creating && error && <div className="rounded-xl border border-state-danger/20 bg-state-danger/[0.06] px-4 py-3 text-[13px] text-state-danger">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kurser.map((kurs) => {
          const kursKlasser = klasser.filter((k) => k.kursId === kurs.id);
          const totalStudents = kursKlasser.reduce((sum, k) => sum + k.students.length, 0);

          return (
            <div key={kurs.id} className="relative">
              <Surface href={`/courses/${kurs.id}`} padding="p-6" className="relative h-full">
                <div className="absolute right-5 top-5 text-ink-muted/50 transition-colors group-hover:text-ink-secondary">
                  <LineIcon name="graduation-cap" className="h-5 w-5" />
                </div>

                <div className="text-[11px] uppercase tracking-[0.12em] font-medium text-ink-muted">
                  {kurs.code || (kurs.isCustom ? "Egen kurs" : "Kurs")}
                </div>
                <h2 className="mt-1.5 pr-8 text-[17px] font-medium tracking-[-0.01em] text-ink">
                  {kurs.name}
                </h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary line-clamp-3">
                  {kurs.description || `${kurs.subject}${kurs.level ? ` · ${kurs.level}` : ""}`}
                </p>

                <div className="mt-5 flex items-center gap-5 text-[13px] text-ink-secondary">
                  <span className="flex items-center gap-1.5">
                    <LineIcon name="users" className="h-3.5 w-3.5 opacity-70" />
                    {kursKlasser.length} {kursKlasser.length === 1 ? "klass" : "klasser"}
                  </span>
                  <span>{totalStudents} elever</span>
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
              {kurs.isCustom && (
                <div className="absolute bottom-4 right-4 z-10">
                  {confirmDelete === kurs.id ? (
                    <div className="flex items-center gap-1 rounded-lg border border-state-danger/20 bg-paper-raised p-1 shadow-card">
                      <button type="button" onClick={() => setConfirmDelete(null)} className="px-2 py-1 text-[11px] text-ink-muted">Avbryt</button>
                      <button type="button" onClick={() => deleteCourse(kurs.id)} className="rounded-md bg-state-danger px-2 py-1 text-[11px] font-medium text-white">Radera</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(kurs.id)} className="rounded-lg border border-ink-hairline bg-paper-raised px-2.5 py-1.5 text-[11px] text-ink-muted shadow-soft transition-colors hover:text-state-danger">
                      Ta bort
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
