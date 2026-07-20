"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useStore, actions, type Prov, type StudentResult, type GradingParams } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import GradingWizard from "@/components/GradingWizard";
import LineIcon from "@/components/LineIcon";

export default function ClassPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const klasser = useStore((s) => s.klasser);
  const allProv = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const kurser = useStore((s) => s.kurser);
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const klass = useMemo(() => klasser.find((k) => k.id === params.id), [klasser, params.id]);
  const prov = useMemo(() => allProv.filter((p) => p.klassId === params.id), [allProv, params.id]);

  const [tab, setTab] = useState<"prov" | "overview" | "params">("prov");
  const [wizardOpen, setWizardOpen] = useState(false);

  if (!klass) {
    return (
      <div className={`text-center py-20 ${isDark ? "text-white/50" : "text-slate-500"}`}>
        Klassen kunde inte hittas. <Link href="/" className="underline">Till klasslistan</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <Link 
            href="/courses" 
            className={`hover:underline ${isDark ? "text-white/60" : "text-slate-500"}`}
          >
            Kurser
          </Link>
          <span className={isDark ? "text-white/40" : "text-slate-400"}>/</span>
          <Link 
            href={`/courses/${klass.kursId}`}
            className={`hover:underline ${isDark ? "text-white/60" : "text-slate-500"}`}
          >
            {kurser.find((c) => c.id === klass.kursId)?.name || "Kurs"}
          </Link>
          <span className={isDark ? "text-white/40" : "text-slate-400"}>/</span>
          <span className={isDark ? "text-white" : "text-slate-900"}>{klass.name}</span>
        </nav>
        
        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className={`text-[11px] uppercase tracking-[0.08em] font-medium ${isDark ? "text-white/40" : "text-slate-400"}`}>
              {kurser.find((c) => c.id === klass.kursId)?.name || "Kurs"} · {klass.students.length} elever
            </div>
            <h1 className={`mt-1 text-[40px] font-bold tracking-[-0.02em] ${isDark ? "text-white" : "text-slate-900"}`}>
              {klass.name}
            </h1>
          </div>
          <button
            onClick={() => setWizardOpen(true)}
            className="rounded-xl px-6 py-3 text-sm font-semibold bg-[#e8b0e4] text-slate-900 hover:bg-[#d89dd3] transition-all active:scale-[0.98]"
          >
            + Rätta nytt prov
          </button>
        </div>

        <div className={`mt-6 flex gap-1 border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>
          <Tab active={tab === "prov"} onClick={() => setTab("prov")} isDark={isDark}>Prov ({prov.length})</Tab>
          <Tab active={tab === "overview"} onClick={() => setTab("overview")} isDark={isDark}>Kursöversikt</Tab>
          <Tab active={tab === "params"} onClick={() => setTab("params")} isDark={isDark}>Inställningar</Tab>
        </div>
      </div>

      {tab === "prov" && (
        <ProvTab klassId={klass.id} prov={prov} results={results} onOpenWizard={() => setWizardOpen(true)} isDark={isDark} />
      )}
      {tab === "overview" && (
        <CourseOverviewTab prov={prov} results={results} isDark={isDark} />
      )}
      {tab === "params" && <ParamsTab klassId={klass.id} initial={klass.gradingParams} isDark={isDark} />}

      <GradingWizard
        klass={klass}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onStarted={(provId) => router.push(`/classes/${klass.id}/grade/${provId}`)}
      />
    </div>
  );
}

function Tab({ active, onClick, children, isDark }: { active: boolean; onClick: () => void; children: React.ReactNode; isDark: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
        active 
          ? isDark ? "text-white" : "text-slate-900"
          : isDark ? "text-white/50 hover:text-white" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
      {active && <span className={`absolute left-2 right-2 -bottom-px h-0.5 rounded-full ${isDark ? "bg-white" : "bg-slate-900"}`} />}
    </button>
  );
}

function ProvTab({
  klassId,
  prov,
  results,
  onOpenWizard,
  isDark,
}: {
  klassId: string;
  prov: Prov[];
  results: StudentResult[];
  onOpenWizard: () => void;
  isDark: boolean;
}) {
  if (prov.length === 0) {
    return (
      <div className={`rounded-2xl border-2 border-dashed p-14 text-center ${
        isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
      }`}>
        <div className={`mx-auto h-14 w-14 rounded-2xl grid place-items-center ${
          isDark ? "bg-[#e8b0e4]/10" : "bg-[#e8b0e4]/15"
        }`}>
          <LineIcon name="file" className={`h-6 w-6 ${isDark ? "text-[#e8b0e4]" : "text-[#c78bbf]"}`} />
        </div>
        <h3 className={`mt-5 text-lg font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
          Inga prov i denna klass ännu
        </h3>
        <p className={`mt-2 text-sm max-w-md mx-auto ${isDark ? "text-white/50" : "text-slate-500"}`}>
          Klicka på <em>Rätta nytt prov</em> för att ladda upp en skannad bunt – wiseOS sektionerar per elev och rättar mot facit.
        </p>
        <button 
          onClick={onOpenWizard} 
          className="mt-6 rounded-xl px-5 py-2.5 text-sm font-semibold bg-[#e8b0e4] text-slate-900 hover:bg-[#d89dd3] transition-all"
        >
          Rätta nytt prov
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {prov.map((p) => {
        const provResults = results.filter((r) => r.provId === p.id);
        const status = p.status as string;
        return (
          <Link
            key={p.id}
            href={`/classes/${klassId}/grade/${p.id}`}
            className={`group relative rounded-2xl p-5 transition-all hover:-translate-y-0.5 ${
              isDark
                ? "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
                : "bg-white border border-slate-200/60 shadow-soft hover:shadow-card"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className={`text-base font-semibold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                  {p.title}
                </div>
                <div className={`mt-1 text-xs ${isDark ? "text-white/40" : "text-slate-500"}`}>
                  {new Date(p.createdAt).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
              <StatusPill status={status} isDark={isDark} />
            </div>
            {p.facit && (
              <div className={`mt-4 text-xs font-mono line-clamp-2 ${isDark ? "text-white/40" : "text-slate-500"}`}>
                Facit: {p.facit.replace(/\n/g, " · ")}
              </div>
            )}
            <div className={`mt-4 flex items-center gap-2 text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}>
              <span><strong className={isDark ? "text-white" : "text-slate-900"}>{provResults.length}</strong> elever</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function StatusPill({ status, isDark }: { status: string; isDark: boolean }) {
  const map: Record<string, { label: string; light: string; dark: string }> = {
    draft: {
      label: "Utkast",
      light: "bg-slate-50 text-slate-600 ring-slate-200",
      dark: "bg-white/10 text-white/60 ring-white/20",
    },
    grading: {
      label: "Rättar…",
      light: "bg-wise-50 text-wise-700 ring-wise-100",
      dark: "bg-wise-300/20 text-wise-300 ring-wise-300/30",
    },
    review: {
      label: "Granskning",
      light: "bg-amber-50 text-amber-700 ring-amber-100",
      dark: "bg-amber-500/20 text-amber-300 ring-amber-500/30",
    },
    published: {
      label: "Publicerad",
      light: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      dark: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
    },
  };
  const s = map[status] || map.draft;
  return (
    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ${isDark ? s.dark : s.light}`}>
      {(status === "grading" || status === "review") && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse mr-1.5" />
      )}
      {s.label}
    </span>
  );
}

// V2: Kursöversikt - Matrisvy (Elev × Prov) för betygsstöd
function CourseOverviewTab({
  prov,
  results,
  isDark,
}: {
  prov: Prov[];
  results: StudentResult[];
  isDark: boolean;
}) {
  // Gruppera resultat per elev
  const studentMap = useMemo(() => {
    const map = new Map<string, { name: string; results: Map<string, number> }>();
    
    results.forEach((r) => {
      if (!map.has(r.studentId)) {
        map.set(r.studentId, { name: r.studentName, results: new Map() });
      }
      // Beräkna totalpoäng för detta prov (V2)
      const total = r.steps.reduce((sum, step) => sum + step.earnedPoints, 0);
      const maxPoints = r.steps.reduce((sum, step) => sum + step.maxPoints, 0);
      map.get(r.studentId)!.results.set(r.provId, Math.round((total / maxPoints) * 100));
    });
    
    return map;
  }, [results]);

  const students = Array.from(studentMap.entries()).map(([id, data]) => ({
    id,
    name: data.name,
    results: data.results,
  }));

  if (prov.length === 0 || students.length === 0) {
    return (
      <div className={`rounded-2xl border-2 border-dashed p-14 text-center ${
        isDark ? "border-white/10 bg-white/5" : "border-slate-200 bg-white"
      }`}>
        <div className={`text-base font-medium ${isDark ? "text-white/60" : "text-slate-500"}`}>
          Ingen data att visa ännu
        </div>
        <p className={`mt-2 text-sm ${isDark ? "text-white/40" : "text-slate-400"}`}>
          Rätta minst ett prov för att se kursöversikten.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`text-sm ${isDark ? "text-white/60" : "text-slate-600"}`}>
        Översikt av alla elevers resultat för betygsstöd. Klicka på en elev för att se detaljer.
      </div>
      
      <div className={`rounded-2xl overflow-hidden ${
        isDark ? "bg-white/5 border border-white/10" : "bg-white border border-slate-200 shadow-soft"
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={isDark ? "bg-white/5" : "bg-slate-50"}>
                <th className={`sticky left-0 z-10 px-4 py-3 text-left font-semibold ${
                  isDark ? "bg-[#1a1a1a] text-white/80" : "bg-slate-50 text-slate-700"
                }`}>
                  Elev
                </th>
                {prov.map((p) => (
                  <th key={p.id} className={`px-4 py-3 text-center font-medium min-w-[100px] ${
                    isDark ? "text-white/60" : "text-slate-600"
                  }`}>
                    <div className="truncate max-w-[120px]" title={p.title}>
                      {p.title.length > 15 ? p.title.slice(0, 15) + "…" : p.title}
                    </div>
                  </th>
                ))}
                <th className={`px-4 py-3 text-center font-semibold ${
                  isDark ? "text-white/80" : "text-slate-700"
                }`}>
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-white/5" : "divide-slate-100"}`}>
              {students.map((student) => {
                const scores = prov.map((p) => student.results.get(p.id) ?? null);
                const validScores = scores.filter((s): s is number => s !== null);
                const trend = validScores.length >= 2 
                  ? validScores[validScores.length - 1] - validScores[0]
                  : 0;
                
                return (
                  <tr key={student.id} className={`${
                    isDark ? "hover:bg-white/5" : "hover:bg-slate-50"
                  } transition-colors`}>
                    <td className={`sticky left-0 z-10 px-4 py-3 font-medium ${
                      isDark ? "bg-[#0a0a0a] text-white" : "bg-white text-slate-900"
                    }`}>
                      <Link 
                        href={`/student/${student.id}`}
                        className="hover:underline"
                      >
                        {student.name}
                      </Link>
                    </td>
                    {prov.map((p) => {
                      const score = student.results.get(p.id);
                      return (
                        <td key={p.id} className="px-4 py-3 text-center">
                          {score !== undefined ? (
                            <span className={`inline-flex items-center justify-center min-w-[48px] px-2 py-1 rounded-lg font-medium ${
                              score >= 80 
                                ? isDark ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-50 text-emerald-700"
                                : score >= 50
                                ? isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-50 text-amber-700"
                                : isDark ? "bg-red-500/20 text-red-400" : "bg-red-50 text-red-700"
                            }`}>
                              {score}%
                            </span>
                          ) : (
                            <span className={isDark ? "text-white/20" : "text-slate-300"}>–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      {validScores.length >= 2 && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                          trend > 0 
                            ? "text-emerald-500" 
                            : trend < 0 
                            ? "text-red-500" 
                            : isDark ? "text-white/40" : "text-slate-400"
                        }`}>
                          {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}
                          {Math.abs(trend)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Legend */}
      <div className={`flex items-center gap-6 text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded ${isDark ? "bg-emerald-500/20" : "bg-emerald-50"}`} />
          ≥80% Godkänt
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded ${isDark ? "bg-amber-500/20" : "bg-amber-50"}`} />
          50-79%
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded ${isDark ? "bg-red-500/20" : "bg-red-50"}`} />
          &lt;50%
        </div>
      </div>
    </div>
  );
}

// V2: Avancerade rättningsparametrar
function ParamsTab({ klassId, initial, isDark }: { klassId: string; initial: GradingParams; isDark: boolean }) {
  const [params, setParams] = useState<GradingParams>(initial);
  const [customRulesText, setCustomRulesText] = useState(initial.customRules.join('\n'));
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const save = () => {
    const updatedParams = {
      ...params,
      customRules: customRulesText.split('\n').filter((r) => r.trim()),
    };
    actions.updateKlassParams(klassId, updatedParams);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Toggle = ({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-[#e8b0e4]' : isDark ? 'bg-white/20' : 'bg-slate-200'
        }`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'left-4' : 'left-0.5'}`} />
      </button>
      <div>
        <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>{label}</div>
        {hint && <div className={`text-xs mt-0.5 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>{hint}</div>}
      </div>
    </label>
  );

  return (
    <div className="max-w-3xl space-y-4">
      {/* Standardinställningar */}
      <div className={`rounded-2xl p-7 ${
        isDark ? "bg-white/5 border border-white/10" : "bg-white border border-slate-200/60 shadow-soft"
      }`}>
        <h2 className={`text-lg font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
          Rättningsinställningar
        </h2>
        <p className={`mt-1.5 text-sm leading-relaxed ${isDark ? "text-white/60" : "text-slate-600"}`}>
          Dessa inställningar gäller automatiskt för alla prov i denna klass.
        </p>
        
        <div className="mt-6 space-y-4">
          <Toggle
            checked={params.allowPartialCredit}
            onChange={(v) => setParams({ ...params, allowPartialCredit: v })}
            label="Delpoäng tillåtna"
            hint="Ge poäng för delvis korrekta svar"
          />
          <Toggle
            checked={params.requireWorkShown}
            onChange={(v) => setParams({ ...params, requireWorkShown: v })}
            label="Kräv uträkning"
            hint="Dra av poäng om bara svar anges utan uträkning"
          />
          <Toggle
            checked={params.significantFigures}
            onChange={(v) => setParams({ ...params, significantFigures: v })}
            label="Gällande siffror viktiga"
            hint="Kontrollera antal signifikanta siffror"
          />
        </div>

        {/* Avancerade inställningar */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`mt-6 text-sm font-medium ${isDark ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {showAdvanced ? '▼' : '▶'} Avancerade inställningar
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pt-4 border-t border-dashed border-slate-200">
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Enhetsavdrag</div>
                <div className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Poäng att dra av om enhet saknas</div>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="2"
                  value={params.unitErrorPenalty}
                  onChange={(e) => setParams({ ...params, unitErrorPenalty: Number(e.target.value) })}
                  className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${
                    isDark ? 'bg-white/5 border-white/10 text-white' : 'border-slate-200'
                  }`}
                />
              </label>
              <label className="block">
                <div className={`text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>Avrundningstolerans</div>
                <div className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-500'}`}>Accepterad avvikelse i %</div>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="20"
                  value={params.roundingTolerance}
                  onChange={(e) => setParams({ ...params, roundingTolerance: Number(e.target.value) })}
                  className={`mt-2 w-full rounded-lg border px-3 py-2 text-sm ${
                    isDark ? 'bg-white/5 border-white/10 text-white' : 'border-slate-200'
                  }`}
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Anpassade regler */}
      <div className={`rounded-2xl p-7 ${
        isDark ? "bg-white/5 border border-white/10" : "bg-white border border-slate-200/60 shadow-soft"
      }`}>
        <h2 className={`text-lg font-semibold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
          Anpassade bedömningsregler
        </h2>
        <p className={`mt-1.5 text-sm leading-relaxed ${isDark ? "text-white/60" : "text-slate-600"}`}>
          Skriv specifika regler för AI:n att följa. En regel per rad.
        </p>
        <textarea
          value={customRulesText}
          onChange={(e) => setCustomRulesText(e.target.value)}
          className={`mt-5 min-h-[140px] w-full rounded-xl border px-3.5 py-2.5 text-sm leading-relaxed transition-all focus:outline-none focus:ring-2 ${
            isDark
              ? "bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:ring-white/20"
              : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:ring-slate-900/5"
          }`}
          placeholder={`Exempel:\nDra endast av för avrundningsfel om det sker mer än en gång.\nAcceptera alternativa lösningsmetoder om resonemanget håller.\nVara extra noggrann med att enheter är korrekta.`}
        />
        <div className="mt-4 flex items-center justify-between">
          <div className={`text-xs ${isDark ? "text-white/50" : "text-slate-500"}`}>
            {saved ? (
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <LineIcon name="check" className="h-3.5 w-3.5" /> Sparat
              </span>
            ) : (
              "Sparas i klassens profil"
            )}
          </div>
          <button 
            onClick={save} 
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition-all ${
              isDark ? "bg-white text-slate-900 hover:bg-white/90" : "bg-slate-900 text-white hover:bg-slate-800"
            }`}
          >
            Spara inställningar
          </button>
        </div>
      </div>

      <div className={`rounded-2xl p-5 text-xs leading-relaxed ${
        isDark ? "bg-amber-500/10 border border-amber-500/20 text-amber-200" : "bg-amber-50/60 border border-amber-200 text-amber-900"
      }`}>
        <strong>Tips:</strong> Per-prov-instruktioner som du anger vid rättning <em>läggs ovanpå</em> dessa klassparametrar.
      </div>
    </div>
  );
}
