"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useStore, actions, type Prov, type StudentResult, type GradingParams } from "@/lib/store";
import GradingWizard from "@/components/GradingWizard";
import LineIcon from "@/components/LineIcon";
import Breadcrumb from "@/components/ui/Breadcrumb";
import Surface from "@/components/ui/Surface";
import EmptyState from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";

export default function ClassPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const klasser = useStore((s) => s.klasser);
  const allProv = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const kurser = useStore((s) => s.kurser);
  const hydrated = useStore((s) => s.hydrated);

  const klass = useMemo(() => klasser.find((k) => k.id === params.id), [klasser, params.id]);
  const prov = useMemo(() => allProv.filter((p) => p.klassId === params.id), [allProv, params.id]);

  const [tab, setTab] = useState<"prov" | "overview" | "params">("prov");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [loadingClass, setLoadingClass] = useState(false);
  const [classError, setClassError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!hydrated || klass || loadingClass || classError) return;
    setLoadingClass(true);
    actions.loadKlass(params.id)
      .catch((error) => setClassError((error as Error).message))
      .finally(() => setLoadingClass(false));
  }, [classError, hydrated, klass, loadingClass, params.id]);

  const deleteClass = async () => {
    setDeleting(true);
    setClassError(null);
    try {
      await actions.deleteKlass(params.id);
      router.replace("/classes");
    } catch (error) {
      setClassError((error as Error).message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  if (!klass) {
    if (!hydrated || loadingClass) {
      return <div className="py-20 text-center text-[13px] text-ink-muted">Hämtar klassen…</div>;
    }
    return (
      <div className="text-center py-20 text-ink-secondary">
        Klassen kunde inte hittas. <Link href="/classes" className="text-ink underline">Till klasslistan</Link>
        {classError && <div className="mt-3 text-[12.5px] text-state-danger">{classError}</div>}
      </div>
    );
  }

  const kursName = kurser.find((c) => c.id === klass.kursId)?.name || klass.kursId || "Kurs";

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumb
          items={[
            { label: "Kurser", href: "/courses" },
            { label: kursName, href: `/courses/${klass.kursId}` },
            { label: klass.name },
          ]}
        />

        <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.1em] font-medium text-ink-muted">
              {kursName} · {klass.students.length} elever
            </div>
            <h1 className="mt-1.5 text-[28px] font-medium tracking-[-0.02em] text-ink">
              {klass.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {confirmDelete ? (
              <div className="flex items-center gap-2 rounded-xl border border-state-danger/20 bg-state-danger/[0.06] p-1.5 pl-3">
                <span className="text-[12px] text-state-danger">Radera klass och all provdata?</span>
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={deleting} className="rounded-lg px-3 py-1.5 text-[12px] text-ink-secondary hover:bg-ink/[0.05]">
                  Avbryt
                </button>
                <button type="button" onClick={deleteClass} disabled={deleting} className="rounded-lg bg-state-danger px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">
                  {deleting ? "Raderar…" : "Ja, radera"}
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-ink-hairline px-3.5 py-2 text-[12.5px] text-ink-muted transition-colors hover:border-state-danger/30 hover:text-state-danger">
                Ta bort klass
              </button>
            )}
            <button onClick={() => setWizardOpen(true)} className="btn-primary">
              Rätta nytt prov
            </button>
          </div>
        </div>

        <div className="mt-6 flex gap-1 border-b border-ink-hairline">
          <Tab active={tab === "prov"} onClick={() => setTab("prov")}>Prov ({prov.length})</Tab>
          <Tab active={tab === "overview"} onClick={() => setTab("overview")}>Kursöversikt</Tab>
          <Tab active={tab === "params"} onClick={() => setTab("params")}>Inställningar</Tab>
        </div>
      </div>

      {tab === "prov" && (
        <ProvTab klassId={klass.id} prov={prov} results={results} onOpenWizard={() => setWizardOpen(true)} />
      )}
      {tab === "overview" && <CourseOverviewTab prov={prov} results={results} />}
      {tab === "params" && <ParamsTab klassId={klass.id} initial={klass.gradingParams} />}

      <GradingWizard
        klass={klass}
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onStarted={(provId) => router.push(`/classes/${klass.id}/grade/${provId}`)}
      />
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-[13.5px] font-medium transition-colors ${
        active ? "text-ink" : "text-ink-muted hover:text-ink-secondary"
      }`}
    >
      {children}
      {active && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-ink" />}
    </button>
  );
}

function ProvTab({
  klassId,
  prov,
  results,
  onOpenWizard,
}: {
  klassId: string;
  prov: Prov[];
  results: StudentResult[];
  onOpenWizard: () => void;
}) {
  if (prov.length === 0) {
    return (
      <EmptyState
        icon="file"
        title="Inga prov i denna klass ännu"
        description="Klicka på Rätta nytt prov för att ladda upp en skannad bunt – WiseOS sektionerar per elev och rättar mot facit."
        action={
          <button onClick={onOpenWizard} className="btn-primary">
            Rätta nytt prov
          </button>
        }
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {prov.map((p) => {
        const provResults = results.filter((r) => r.provId === p.id);
        return (
          <Surface key={p.id} href={`/classes/${klassId}/grade/${p.id}`} padding="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-medium truncate text-ink">{p.title}</div>
                <div className="mt-1 text-[12px] text-ink-muted">
                  {new Date(p.createdAt).toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" })}
                </div>
              </div>
              <StatusBadge status={p.status as string} />
            </div>
            {p.facit && (
              <div className="mt-4 text-[12px] font-mono line-clamp-2 text-ink-muted">
                Facit: {p.facit.replace(/\n/g, " · ")}
              </div>
            )}
            <div className="mt-4 text-[12.5px] text-ink-secondary">
              <strong className="font-medium text-ink">{provResults.length}</strong> elever
            </div>
          </Surface>
        );
      })}
    </div>
  );
}

// V2: Kursöversikt - Matrisvy (Elev × Prov) för betygsstöd
function CourseOverviewTab({
  prov,
  results,
}: {
  prov: Prov[];
  results: StudentResult[];
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
      <EmptyState
        icon="chart"
        title="Ingen data att visa ännu"
        description="Rätta minst ett prov för att se kursöversikten."
      />
    );
  }

  const scoreTint = (score: number) =>
    score >= 80
      ? "bg-accent/[0.12] text-accent"
      : score >= 50
      ? "bg-ink/[0.05] text-ink-secondary"
      : "bg-state-danger/[0.12] text-state-danger";

  return (
    <div className="space-y-4">
      <p className="text-[13.5px] text-ink-secondary">
        Översikt av alla elevers resultat för betygsstöd. Klicka på en elev för att se detaljer.
      </p>

      <div className="rounded-[16px] overflow-hidden bg-paper-raised border border-ink-hairline shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-ink-hairline">
                <th className="sticky left-0 z-10 bg-paper-secondary px-4 py-3 text-left font-medium text-ink-secondary">
                  Elev
                </th>
                {prov.map((p) => (
                  <th key={p.id} className="px-4 py-3 text-center font-medium min-w-[100px] text-ink-muted">
                    <div className="truncate max-w-[120px] mx-auto" title={p.title}>
                      {p.title.length > 15 ? p.title.slice(0, 15) + "…" : p.title}
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-medium text-ink-secondary">Trend</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const scores = prov.map((p) => student.results.get(p.id) ?? null);
                const validScores = scores.filter((s): s is number => s !== null);
                const trend = validScores.length >= 2
                  ? validScores[validScores.length - 1] - validScores[0]
                  : 0;

                return (
                  <tr key={student.id} className="border-t border-ink-hairline hover:bg-ink/[0.02] transition-colors">
                    <td className="sticky left-0 z-10 bg-paper-raised px-4 py-3 font-medium text-ink">
                      <Link href={`/student/${student.id}`} className="hover:text-accent transition-colors">
                        {student.name}
                      </Link>
                    </td>
                    {prov.map((p) => {
                      const score = student.results.get(p.id);
                      return (
                        <td key={p.id} className="px-4 py-3 text-center">
                          {score !== undefined ? (
                            <span className={`inline-flex items-center justify-center min-w-[48px] px-2 py-1 rounded-[8px] font-medium tabular-nums ${scoreTint(score)}`}>
                              {score}%
                            </span>
                          ) : (
                            <span className="text-ink-muted/50">–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      {validScores.length >= 2 && (
                        <span className={`inline-flex items-center gap-1 text-[12px] font-medium tabular-nums ${
                          trend > 0 ? "text-accent" : trend < 0 ? "text-state-danger" : "text-ink-muted"
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
      <div className="flex items-center gap-6 text-[12px] text-ink-muted">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-accent/[0.12]" />≥80% Godkänt
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-ink/[0.05]" />50-79%
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-state-danger/[0.12]" />&lt;50%
        </div>
      </div>
    </div>
  );
}

// V2: Avancerade rättningsparametrar
function ParamsTab({ klassId, initial }: { klassId: string; initial: GradingParams }) {
  const [params, setParams] = useState<GradingParams>(initial);
  const [customRulesText, setCustomRulesText] = useState(initial.customRules.join('\n'));
  const [saved, setSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const save = async () => {
    const updatedParams = {
      ...params,
      customRules: customRulesText.split('\n').filter((r) => r.trim()),
    };
    setSaveError(null);
    try {
      await actions.updateKlassParams(klassId, updatedParams);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  const Toggle = ({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) => (
    <label className="flex items-start gap-3 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 rounded-full transition-colors ${
          checked ? 'bg-accent' : 'bg-ink/15'
        }`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper-raised shadow transition-transform ${checked ? 'left-4' : 'left-0.5'}`} />
      </button>
      <div>
        <div className="text-[14px] font-medium text-ink">{label}</div>
        {hint && <div className="text-[12.5px] mt-0.5 text-ink-muted">{hint}</div>}
      </div>
    </label>
  );

  return (
    <div className="max-w-3xl space-y-4">
      {/* Standardinställningar */}
      <div className="rounded-[16px] p-7 bg-paper-raised border border-ink-hairline shadow-soft">
        <h2 className="text-[16px] font-medium tracking-[-0.01em] text-ink">
          Rättningsinställningar
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">
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
          className="mt-6 text-[13.5px] font-medium text-ink-secondary hover:text-ink transition-colors"
        >
          {showAdvanced ? '▼' : '▶'} Avancerade inställningar
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-4 pt-5 border-t border-ink-hairline">
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <div className="text-[14px] font-medium text-ink">Enhetsavdrag</div>
                <div className="text-[12.5px] text-ink-muted">Poäng att dra av om enhet saknas</div>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  max="2"
                  value={params.unitErrorPenalty}
                  onChange={(e) => setParams({ ...params, unitErrorPenalty: Number(e.target.value) })}
                  className="input mt-2"
                />
              </label>
              <label className="block">
                <div className="text-[14px] font-medium text-ink">Avrundningstolerans</div>
                <div className="text-[12.5px] text-ink-muted">Accepterad avvikelse i %</div>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="20"
                  value={params.roundingTolerance}
                  onChange={(e) => setParams({ ...params, roundingTolerance: Number(e.target.value) })}
                  className="input mt-2"
                />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Anpassade regler */}
      <div className="rounded-[16px] p-7 bg-paper-raised border border-ink-hairline shadow-soft">
        <h2 className="text-[16px] font-medium tracking-[-0.01em] text-ink">
          Anpassade bedömningsregler
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">
          Skriv specifika regler för AI:n att följa. En regel per rad.
        </p>
        <textarea
          value={customRulesText}
          onChange={(e) => setCustomRulesText(e.target.value)}
          className="input mt-5 min-h-[140px] leading-relaxed"
          placeholder={`Exempel:\nDra endast av för avrundningsfel om det sker mer än en gång.\nAcceptera alternativa lösningsmetoder om resonemanget håller.\nVara extra noggrann med att enheter är korrekta.`}
        />
        <div className="mt-4 flex items-center justify-between">
          <div className="text-[12.5px] text-ink-muted">
            {saveError ? (
              <span className="text-state-danger">{saveError}</span>
            ) : saved ? (
              <span className="inline-flex items-center gap-1 text-accent">
                <LineIcon name="check" className="h-3.5 w-3.5" /> Sparat
              </span>
            ) : (
              "Sparas i klassens profil"
            )}
          </div>
          <button onClick={save} className="btn-primary">
            Spara inställningar
          </button>
        </div>
      </div>

      <div className="rounded-[16px] p-5 text-[12.5px] leading-relaxed bg-paper-secondary border border-ink-hairline text-ink-secondary">
        <strong className="text-ink font-medium">Tips:</strong> Per-prov-instruktioner som du anger vid rättning <em>läggs ovanpå</em> dessa klassparametrar.
      </div>
    </div>
  );
}
