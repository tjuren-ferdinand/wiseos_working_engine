"use client";

import { useState, useMemo } from "react";
import { useStore, type Prov, type StudentResult, type Klass } from "@/lib/store";
import PublishResultsModal from "./PublishResultsModal";
import LineIcon from "./LineIcon";

export default function ReviewWorkbench() {
  const prov = useStore((s) => s.prov);
  const results = useStore((s) => s.results);
  const klasser = useStore((s) => s.klasser);
  const [selectedProv, setSelectedProv] = useState<Prov | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);

  // Get completed prov (status = "ready")
  const completedProv = prov.filter((p) => p.status === "ready");
  
  // Get results for selected prov
  const selectedResults = selectedProv 
    ? results.filter((r) => r.provId === selectedProv.id)
    : [];

  const getKlassForProv = (provId: string): Klass | undefined => {
    const p = prov.find((pr) => pr.id === provId);
    return p ? klasser.find((k) => k.id === p.klassId) : undefined;
  };

  const getTotalPoints = (result: StudentResult): { points: number; maxPoints: number } => {
    const klass = getKlassForProv(result.provId);
    const provData = prov.find((p) => p.id === result.provId);
    
    const points = result.steps.reduce((sum, step) => {
      const { displayedPoints } = deriveStep(step, klass?.gradingParams || "", provData?.customParams || "");
      return sum + displayedPoints;
    }, 0);
    const maxPoints = result.steps.reduce((sum, step) => sum + step.pointsMax, 0);
    return { points, maxPoints };
  };

  const getGrade = (points: number, maxPoints: number): string => {
    const percentage = (points / maxPoints) * 100;
    if (percentage >= 90) return "A";
    if (percentage >= 80) return "B";
    if (percentage >= 70) return "C";
    if (percentage >= 60) return "D";
    if (percentage >= 50) return "E";
    return "F";
  };

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case "A": return "bg-green-100 text-green-800";
      case "B": return "bg-green-50 text-green-700";
      case "C": return "bg-amber-50 text-amber-700";
      case "D": return "bg-amber-100 text-amber-800";
      case "E": return "bg-orange-50 text-orange-700";
      case "F": return "bg-red-50 text-red-700";
      default: return "bg-slate-50 text-slate-700";
    }
  };

  // Import deriveStep temporarily for this component
  const deriveStep = (step: any, klassParams: string, provParams: string) => {
    const RULE_DEFS: Record<string, { match: RegExp; penalty: number; label: string }> = {
      unit_penalty: { match: /enhet/i, penalty: 0.25, label: "Enhet saknas (−0.25)" },
      sigfig_strict: { match: /gällande siffror|sig.?fig/i, penalty: 0, label: "Fel antal gällande siffror" },
    };
    
    const active = new Set<string>();
    const effectiveRules = step.appliedRules.filter((r: string) => active.has(r));
    const penaltySum = effectiveRules.reduce((sum: number, r: string) => sum + RULE_DEFS[r].penalty, 0);
    const aiSuggested = Math.max(0, step.pointsBase - penaltySum);
    const displayedPoints = step.status === "edited" && step.pointsTeacher !== null
      ? step.pointsTeacher
      : aiSuggested;
    
    return { displayedPoints, aiSuggested, effectiveRules };
  };

  if (completedProv.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-16 text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-wise-50 text-wise-600 grid place-items-center mb-4">
          <LineIcon name="clipboard" className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">Inga rättade prov än</h3>
        <p className="text-slate-600">När prov är rättade kommer de att dyka upp här för granskning.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Prov Selection */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Rättade prov</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {completedProv.map((p) => {
            const klass = getKlassForProv(p.id);
            const provResults = results.filter((r) => r.provId === p.id);
            const publishedCount = provResults.filter((r) => r.isPublished).length;
            
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProv(p)}
                className={`rounded-3xl border p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                  selectedProv?.id === p.id
                    ? "border-wise-300 bg-wise-50/50 shadow-lg"
                    : "border-slate-200 bg-white hover:border-wise-200"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 group-hover:text-wise-700 transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1">{klass?.name}</p>
                  </div>
                  {publishedCount > 0 && (
                    <span className="rounded-full bg-green-100 text-green-800 px-2 py-1 text-xs font-medium">
                      {publishedCount}/{provResults.length} publicerade
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-4 text-sm text-slate-500">
                  <span>{provResults.length} elever</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300" />
                  <span>Rättad</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Prov Results */}
      {selectedProv && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-slate-900">{selectedProv.title}</h3>
              <p className="text-slate-600">
                {selectedResults.length} elever · {selectedResults.filter((r) => r.isPublished).length} publicerade
              </p>
            </div>
            
            <button
              onClick={() => setShowPublishModal(true)}
              className="relative rounded-full bg-wise-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-wise-700 hover:shadow-lg hover:shadow-wise-600/20 active:scale-[0.98] overflow-hidden"
            >
              <span className="relative z-10 flex items-center gap-2">
                <LineIcon name="send" className="h-4 w-4" />
                Publicera resultat
              </span>
              {/* Pulse animation */}
              <span className="absolute inset-0 bg-wise-700 animate-ping opacity-20" />
            </button>
          </div>

          <div className="grid gap-4">
            {selectedResults.map((result) => {
              const { points, maxPoints } = getTotalPoints(result);
              const grade = getGrade(points, maxPoints);
              const gradeColorClass = getGradeColor(grade);
              
              return (
                <div
                  key={result.id}
                  className={`rounded-3xl border p-6 transition-all ${
                    result.isPublished
                      ? "border-green-200 bg-green-50/30"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wise-100 text-wise-600 font-semibold text-lg">
                        {result.studentName.charAt(0)}
                      </div>
                      
                      <div>
                        <h4 className="font-semibold text-slate-900">{result.studentName}</h4>
                        <p className="text-sm text-slate-600">
                          {points}/{maxPoints} poäng
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-3 py-1 text-sm font-medium ${gradeColorClass}`}>
                        Betyg: {grade}
                      </span>
                      
                      {result.isPublished && (
                        <span className="rounded-full bg-green-100 text-green-800 px-3 py-1 text-xs font-medium flex items-center gap-1">
                          <LineIcon name="check" className="h-3 w-3" />
                          Publicerad
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {selectedProv && (
        <PublishResultsModal
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          prov={selectedProv}
          results={selectedResults}
        />
      )}
    </div>
  );
}
