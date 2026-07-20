"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import LineIcon from "./LineIcon";

const ONBOARDING_KEY = "wiseos_onboarding_completed";

interface OnboardingStep {
  title: string;
  description: string;
  icon: "upload" | "sparkles" | "edit" | "check";
}

const steps: OnboardingStep[] = [
  {
    title: "Ladda upp elevprov",
    description: "Ladda upp skannade prov som PDF eller bilder. WiseOS hanterar flera format och sidor automatiskt.",
    icon: "upload",
  },
  {
    title: "AI analyserar",
    description: "Vår AI läser av elevens lösningar, verifierar matematiken och genererar personlig feedback på svenska.",
    icon: "sparkles",
  },
  {
    title: "Se elevens tanke",
    description: "Granska originalprovet sida vid sida med AI:ns analys. Se exakt var eleven behöver stöd.",
    icon: "edit",
  },
  {
    title: "Godkänn och exportera",
    description: "Du har alltid sista ordet. Justera betyg, redigera feedback och exportera till ditt skolsystem.",
    icon: "check",
  },
];

export function useOnboarding() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      setShouldShow(true);
    }
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShouldShow(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    setShouldShow(true);
  };

  return { shouldShow, completeOnboarding, resetOnboarding };
}

export default function Onboarding() {
  const { shouldShow, completeOnboarding } = useOnboarding();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [isOpen, setIsOpen] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (shouldShow) {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [shouldShow]);

  const handleSkip = () => {
    setIsOpen(false);
    completeOnboarding();
  };

  const handleExplore = () => {
    setShowSteps(true);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsOpen(false);
      completeOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 transition-opacity duration-500 ${
          isDark ? "bg-black/80" : "bg-slate-900/60"
        } backdrop-blur-sm`}
        onClick={handleSkip}
      />

      {/* Modal */}
      <div 
        className={`relative w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl transform transition-all duration-500 ${
          isDark 
            ? "bg-[#1a1a1a] border border-white/10" 
            : "bg-white"
        }`}
        style={{
          animation: "modalSlideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {!showSteps ? (
          /* Welcome Screen */
          <div className="p-10 text-center">
            {/* Logo */}
            <div className="mb-8 flex items-center justify-center gap-3">
              <img 
                src="/logotype_new.png" 
                alt="WiseOS" 
                className="h-11 w-auto"
                style={{
                  animation: "logoFadeIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
                }}
              />
              <span 
                className={`text-[26px] font-semibold tracking-tight ${
                  isDark ? "text-white" : "text-slate-800"
                }`}
                style={{
                  background: isDark 
                    ? "linear-gradient(135deg, #ffffff 0%, #e8b0e4 100%)"
                    : "linear-gradient(135deg, #1e293b 0%, #9B5A97 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "textSlideIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both",
                }}
              >
                WiseOS
              </span>
            </div>

            <h1 className={`text-3xl font-bold tracking-tight mb-3 ${
              isDark ? "text-white" : "text-slate-900"
            }`}>
              Välkommen till WiseOS
            </h1>
            
            <p className={`text-lg mb-10 ${
              isDark ? "text-white/60" : "text-slate-500"
            }`}>
              Din AI-assistent för snabbare och smartare rättning.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleExplore}
                className={`w-full py-4 px-6 rounded-2xl text-base font-semibold transition-all duration-200 ${
                  isDark
                    ? "bg-[#e8b0e4] text-[#1a1a1a] hover:bg-[#d9a0d5]"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                Utforska WiseOS
              </button>
              
              <button
                onClick={handleSkip}
                className={`w-full py-4 px-6 rounded-2xl text-base font-medium transition-all duration-200 ${
                  isDark
                    ? "text-white/50 hover:text-white hover:bg-white/5"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                Hoppa över
              </button>
            </div>
          </div>
        ) : (
          /* Steps Screen */
          <div className="p-8">
            {/* Progress */}
            <div className="flex gap-2 mb-8">
              {steps.map((_, index) => (
                <div 
                  key={index}
                  className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                    index <= currentStep
                      ? isDark ? "bg-[#e8b0e4]" : "bg-slate-900"
                      : isDark ? "bg-white/10" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>

            {/* Step indicator */}
            <p className={`text-xs font-semibold tracking-widest uppercase mb-4 ${
              isDark ? "text-[#e8b0e4]" : "text-slate-400"
            }`}>
              Steg {currentStep + 1} av {steps.length}
            </p>

            {/* Icon */}
            <div className={`w-16 h-16 rounded-2xl mb-6 flex items-center justify-center ${
              isDark ? "bg-[#e8b0e4]/15" : "bg-slate-100"
            }`}>
              <LineIcon 
                name={steps[currentStep].icon} 
                className={`h-8 w-8 ${isDark ? "text-[#e8b0e4]" : "text-slate-700"}`} 
              />
            </div>

            {/* Content */}
            <h2 className={`text-2xl font-bold tracking-tight mb-3 ${
              isDark ? "text-white" : "text-slate-900"
            }`}>
              {steps[currentStep].title}
            </h2>
            
            <p className={`text-base leading-relaxed mb-10 ${
              isDark ? "text-white/60" : "text-slate-500"
            }`}>
              {steps[currentStep].description}
            </p>

            {/* Navigation */}
            <div className="flex gap-3">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className={`flex-1 py-4 px-6 rounded-2xl text-base font-medium transition-all duration-200 ${
                    isDark
                      ? "bg-white/5 text-white hover:bg-white/10"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Tillbaka
                </button>
              )}
              
              <button
                onClick={handleNext}
                className={`flex-1 py-4 px-6 rounded-2xl text-base font-semibold transition-all duration-200 ${
                  isDark
                    ? "bg-[#e8b0e4] text-[#1a1a1a] hover:bg-[#d9a0d5]"
                    : "bg-slate-900 text-white hover:bg-slate-800"
                }`}
              >
                {currentStep < steps.length - 1 ? "Nästa" : "Kom igång"}
              </button>
            </div>

            {/* Skip link */}
            <button
              onClick={handleSkip}
              className={`w-full mt-4 py-2 text-sm transition-colors ${
                isDark ? "text-white/40 hover:text-white/60" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              Hoppa över introduktionen
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes logoFadeIn {
          from {
            opacity: 0;
            transform: scale(0.8) rotate(-8deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        @keyframes textSlideIn {
          from {
            opacity: 0;
            transform: translateX(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
