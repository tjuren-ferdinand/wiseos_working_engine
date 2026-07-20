"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { actions } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import LevelAutocomplete from "@/components/LevelAutocomplete";

export default function NewKlassPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [form, setForm] = useState({
    name: "",
    subject: "Matematik",
    gradeLevel: "Gymnasiet åk 1",
    gradingParams: "",
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const k = actions.createKlass(form);
    router.push(`/classes/${k.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link href="/classes" className={`text-sm transition-colors ${isDark ? "text-white/50 hover:text-white" : "text-slate-500 hover:text-slate-700"}`}>← Tillbaka</Link>
      <h1 className={`mt-6 text-[40px] font-bold tracking-[-0.02em] ${isDark ? "text-white" : "text-slate-900"}`}>Skapa ny klass</h1>
      <p className={`mt-3 text-base ${isDark ? "text-white/50" : "text-slate-500"}`}>En klass samlar prov och har egna rättningsparametrar.</p>

      <form onSubmit={submit} className={`mt-10 space-y-6 rounded-3xl border p-8 ${isDark ? "border-white/10 bg-white/[0.03]" : "border-slate-200 bg-white shadow-sm"}`}>
        <Field label="Klassens namn" hint="t.ex. NA22B – Fysik 1">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
            placeholder="NA22B – Fysik 1"
            required
          />
        </Field>

        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Ämne">
            <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="input">
              <option>Matematik</option>
              <option>Fysik</option>
              <option>Kemi</option>
              <option>Biologi</option>
              <option>Teknik</option>
            </select>
          </Field>
          <Field label="Nivå" hint="Skriv fritt eller välj från fördefinierade alternativ">
            <LevelAutocomplete
              value={form.gradeLevel}
              onChange={(value) => setForm({ ...form, gradeLevel: value })}
              placeholder="t.ex. Gymnasiet åk 2"
            />
          </Field>
        </div>

        <Field
          label="Permanenta rättningsparametrar & noteringar"
          hint="Skickas alltid med när AI:n rättar prov i denna klass. Exempel: ”Gör 0.25 poängs avdrag om enhet saknas”, ”Var extra noggrann med gällande siffror”."
        >
          <textarea
            value={form.gradingParams}
            onChange={(e) => setForm({ ...form, gradingParams: e.target.value })}
            className="input min-h-[120px] font-mono text-[13px] leading-relaxed"
            placeholder="Gör alltid 0.25 poängs avdrag om enhet saknas. Var extra noggrann med gällande siffror. Acceptera alternativa lösningsmetoder om resonemanget håller."
          />
        </Field>

        <div className="flex justify-end gap-3 pt-4">
          <Link href="/classes" className={`rounded-xl border px-5 py-2.5 text-sm font-medium transition-colors ${isDark ? "border-white/10 text-white/70 hover:bg-white/5" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>Avbryt</Link>
          <button type="submit" className="rounded-xl bg-[#e8b0e4] px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-[#d89dd3] active:scale-[0.98] transition-all">Skapa klass</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-slate-700 dark:text-white">{label}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500 dark:text-white/40 leading-relaxed">{hint}</div>}
      <div className="mt-2">{children}</div>
    </label>
  );
}
