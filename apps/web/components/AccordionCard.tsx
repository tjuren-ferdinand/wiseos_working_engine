"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LineIcon from "./LineIcon";
import type { GradingStep } from "@/lib/store";

interface AccordionCardProps {
  step: GradingStep;
  displayedPoints: number;
  effectiveRules: string[];
  isExpanded: boolean;
  onToggle: () => void;
  index: number;
}

export default function AccordionCard({ 
  step, 
  displayedPoints, 
  effectiveRules, 
  isExpanded, 
  onToggle,
  index 
}: AccordionCardProps) {
  const getVerdictColor = (verdict: string): string => {
    switch (verdict) {
      case "correct":
        return "bg-green-50 text-green-700 border-green-200";
      case "partial":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "incorrect":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  const getVerdictIcon = (verdict: string): string => {
    switch (verdict) {
      case "correct":
        return "check-circle";
      case "partial":
        return "alert-circle";
      case "incorrect":
        return "x-circle";
      default:
        return "help-circle";
    }
  };

  const getVerdictText = (verdict: string): string => {
    switch (verdict) {
      case "correct":
        return "Korrekt";
      case "partial":
        return "Delvis korrekt";
      case "incorrect":
        return "Felaktigt";
      default:
        return "Ej bedömt";
    }
  };

  const verdictColorClass = getVerdictColor(step.aiVerdict);
  const verdictIcon = getVerdictIcon(step.aiVerdict);
  const verdictText = getVerdictText(step.aiVerdict);

  return (
    <div className="group">
      {/* Card Header */}
      <motion.button
        onClick={onToggle}
        className="w-full rounded-3xl bg-white/80 backdrop-blur-sm border border-slate-200/60 p-6 text-left transition-all hover:bg-white hover:shadow-lg hover:border-wise-200 focus:outline-none focus:ring-2 focus:ring-wise-500/20"
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Question Number */}
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: index * 0.1, duration: 0.3 }}
              className="flex h-12 w-12 items-center justify-center rounded-2xl bg-wise-100 text-wise-600 font-semibold text-lg"
            >
              {index + 1}
            </motion.div>

            {/* Question Title */}
            <div>
              <h3 className="text-lg font-semibold text-slate-900 group-hover:text-wise-700 transition-colors">
                {step.label}
              </h3>
              <div className="flex items-center gap-3 mt-1">
                <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${verdictColorClass}`}>
                  <LineIcon name={verdictIcon} className="h-3 w-3" />
                  {verdictText}
                </span>
                <span className="text-sm text-slate-600">
                  {displayedPoints}/{step.pointsMax} poäng
                </span>
              </div>
            </div>
          </div>

          {/* Expand Icon */}
          <motion.div 
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-slate-400"
          >
            <LineIcon name="chevron-down" className="h-5 w-5" />
          </motion.div>
        </div>
      </motion.button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-3xl bg-white/60 backdrop-blur-sm border border-slate-200/40 overflow-hidden">
              <motion.div 
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                className="p-6 space-y-6"
              >
                {/* Student Answer */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.3 }}
                >
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <LineIcon name="edit-3" className="h-4 w-4" />
                    Ditt svar
                  </h4>
                  <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4">
                    <p className="text-slate-900 font-mono">{step.studentWork}</p>
                  </div>
                </motion.div>

                {/* AI Feedback */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.3 }}
                >
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <LineIcon name="message-square" className="h-4 w-4" />
                    AI-feedback
                  </h4>
                  <div className="rounded-2xl bg-wise-50/50 border border-wise-200 p-4">
                    <p className="text-slate-800 leading-relaxed">{step.baseAnnotation}</p>
                  </div>
                </motion.div>

                {/* Applied Rules */}
                {effectiveRules.length > 0 && (
                  <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.4, duration: 0.3 }}
                  >
                    <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                      <LineIcon name="alert-triangle" className="h-4 w-4" />
                      Klassregler
                    </h4>
                    <div className="space-y-2">
                      {effectiveRules.map((rule, ruleIndex) => (
                        <motion.div
                          key={rule}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.5 + ruleIndex * 0.1, duration: 0.3 }}
                          className="rounded-2xl bg-amber-50/50 border border-amber-200 p-3"
                        >
                          <p className="text-sm text-amber-800">
                            {rule === "unit_penalty" && "Enhet saknas (−0.25 poäng)"}
                            {rule === "sigfig_strict" && "Fel antal gällande siffror"}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Points Breakdown */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.6, duration: 0.3 }}
                  className="rounded-2xl bg-slate-50 border border-slate-200 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Poäng för denna uppgift</span>
                    <span className="text-lg font-semibold text-slate-900">
                      {displayedPoints}/{step.pointsMax}
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
