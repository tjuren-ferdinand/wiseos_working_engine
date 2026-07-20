"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore, actions, type StudentResult, type Prov } from "@/lib/store";
import LineIcon from "./LineIcon";

interface PublishResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  prov: Prov;
  results: StudentResult[];
}

export default function PublishResultsModal({ isOpen, onClose, prov, results }: PublishResultsModalProps) {
  const [publishMap, setPublishMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    results.forEach((r) => {
      initial[r.studentId || r.id] = !r.isPublished;
    });
    return initial;
  });
  const [isPublishing, setIsPublishing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  if (!isOpen) return null;

  const handleToggle = (studentId: string) => {
    setPublishMap((prev) => ({ ...prev, [studentId]: !prev[studentId] }));
  };

  const handlePublishAll = () => {
    const allEnabled: Record<string, boolean> = {};
    results.forEach((r) => {
      allEnabled[r.studentId || r.id] = true;
    });
    setPublishMap(allEnabled);
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const studentIds = Object.entries(publishMap)
      .filter(([_, enabled]) => enabled)
      .map(([id]) => id);
    
    actions.publishResults(prov.id, studentIds);
    
    setIsPublishing(false);
    setShowSuccess(true);
    
    setTimeout(() => {
      setShowSuccess(false);
      onClose();
    }, 2000);
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

  const getTotalPoints = (result: StudentResult): { points: number; maxPoints: number } => {
    const points = result.steps.reduce((sum, step) => {
      const { displayedPoints } = deriveStep(step, "", "");
      return sum + displayedPoints;
    }, 0);
    const maxPoints = result.steps.reduce((sum, step) => sum + step.pointsMax, 0);
    return { points, maxPoints };
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="relative w-full max-w-2xl rounded-3xl bg-white/95 backdrop-blur-xl shadow-2xl border border-white/20 overflow-hidden"
          >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-200/60">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Publicera resultat</h2>
              <p className="mt-1 text-sm text-slate-600">{prov.title}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <LineIcon name="x" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6 max-h-96 overflow-y-auto">
          <div className="space-y-3">
            {results.map((result) => {
              const { points, maxPoints } = getTotalPoints(result);
              const grade = getGrade(points, maxPoints);
              const studentId = result.studentId || result.id;
              const isEnabled = publishMap[studentId];
              
              return (
                <div
                  key={result.id}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                    isEnabled 
                      ? "bg-wise-50/50 border-wise-200" 
                      : "bg-slate-50/50 border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleToggle(studentId)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        isEnabled ? "bg-wise-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          isEnabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    
                    <div>
                      <h3 className="font-medium text-slate-900">{result.studentName}</h3>
                      <p className="text-sm text-slate-600">{points}/{maxPoints} poäng</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-sm font-medium ${
                      grade === "A" ? "bg-green-100 text-green-800" :
                      grade === "B" ? "bg-green-50 text-green-700" :
                      grade === "C" ? "bg-amber-50 text-amber-700" :
                      grade === "D" ? "bg-amber-100 text-amber-800" :
                      grade === "E" ? "bg-orange-50 text-orange-700" :
                      "bg-red-50 text-red-700"
                    }`}>
                      Betyg: {grade}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-200/60 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <button
              onClick={handlePublishAll}
              className="text-sm text-wise-600 hover:text-wise-700 font-medium transition-colors"
            >
              Välj alla elever
            </button>
            
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-full text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Avbryt
              </button>
              
              <button
                onClick={handlePublish}
                disabled={isPublishing || showSuccess}
                className="relative px-6 py-2.5 rounded-full bg-wise-600 text-white text-sm font-medium transition-all hover:bg-wise-700 hover:shadow-lg hover:shadow-wise-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPublishing ? (
                  <span className="flex items-center gap-2">
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Publicerar...
                  </span>
                ) : showSuccess ? (
                  <span className="flex items-center gap-2">
                    <LineIcon name="check" className="h-4 w-4" />
                    Publicerat!
                  </span>
                ) : (
                  "Skicka till valda"
                )}
              </button>
            </div>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
