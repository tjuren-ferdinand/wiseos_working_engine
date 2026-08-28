"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LOGO_MARK } from "@/lib/logo";
import LineIcon from "./LineIcon";

const ONBOARDING_KEY = "wiseos_onboarding_completed";
const ACCENT = "#ea580c";

interface TourStep {
  title: string;
  description: string;
}

const steps: TourStep[] = [
  {
    title: "Din överblick",
    description:
      "Dashboard samlar det du behöver se först: senaste prov, snabbstatistik och tidsbesparingar.",
  },
  {
    title: "Kurser & klasser",
    description:
      "Skapa klasser, lägg till elever och håll ordning på varje kurs — allt på ett ställe.",
  },
  {
    title: "Rätta prov",
    description:
      "Ladda upp skannade prov, välj facit och låt WiseOS AI rätta under din kontroll.",
  },
  {
    title: "Granska & publicera",
    description:
      "Gå igenom AI:ns analys, justera poäng och feedback, och publicera när du är nöjd.",
  },
];

function StepVisual({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div className="mb-6 overflow-hidden rounded-2xl border border-[#E2E5E9]/10 bg-[#0f1114] p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-[#ea580c]" />
          <div className="h-2 w-20 rounded bg-[#E2E5E9]/10" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-14 rounded-xl bg-[#E2E5E9]/5 p-2">
            <div className="text-[9px] text-[#8a8f96]">Prov</div>
            <div className="text-sm font-semibold text-[#E2E5E9]">12</div>
          </div>
          <div className="h-14 rounded-xl bg-[#E2E5E9]/5 p-2">
            <div className="text-[9px] text-[#8a8f96]">Tid sparad</div>
            <div className="text-sm font-semibold text-[#E2E5E9]">4h</div>
          </div>
          <div className="h-14 rounded-xl bg-[#ea580c]/10 p-2">
            <div className="text-[9px] text-[#ea580c]">AI-rättat</div>
            <div className="text-sm font-semibold text-[#E2E5E9]">89</div>
          </div>
        </div>
        <div className="mt-3 h-2 w-full rounded bg-[#E2E5E9]/5" />
        <div className="mt-2 h-2 w-5/6 rounded bg-[#E2E5E9]/5" />
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="mb-6 space-y-2">
        {[
          { name: "NA22B", count: "28 elever" },
          { name: "TE21A", count: "24 elever" },
        ].map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-3 rounded-2xl border border-[#E2E5E9]/10 bg-[#0f1114] p-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E2E5E9]/5 text-[#E2E5E9]">
              <LineIcon name="graduation-cap" className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-[#E2E5E9]">{c.name}</div>
              <div className="text-[11px] text-[#8a8f96]">{c.count}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="mb-6 rounded-2xl border border-dashed border-[#E2E5E9]/15 bg-[#0f1114] p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ea580c]/10 text-[#ea580c]">
          <LineIcon name="upload" className="h-6 w-6" />
        </div>
        <div className="mt-3 text-sm font-medium text-[#E2E5E9]">Dra hit elevprov</div>
        <div className="mt-1 text-[11px] text-[#8a8f96]">PDF eller bilder</div>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#ea580c] px-4 py-1.5 text-[11px] font-semibold text-white">
          <LineIcon name="play" className="h-3 w-3" />
          Starta rättning
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-[#E2E5E9]/10 bg-[#0f1114] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-[#E2E5E9]">Elev: Erik Svensson</div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#ea580c]/10 text-[#ea580c]">
          <LineIcon name="check" className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-[#E2E5E9]/5" />
        <div className="h-2 w-5/6 rounded bg-[#E2E5E9]/5" />
        <div className="h-2 w-4/6 rounded bg-[#E2E5E9]/5" />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-[#E2E5E9]/5 p-2">
        <span className="text-[11px] text-[#8a8f96]">Poäng</span>
        <span className="text-sm font-bold text-[#E2E5E9]">18/20</span>
      </div>
    </div>
  );
}

export function useOnboarding() {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const completed = typeof window !== "undefined" ? localStorage.getItem(ONBOARDING_KEY) : null;
    if (!completed) setShouldShow(true);
  }, []);

  const completeOnboarding = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShouldShow(false);
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    setShouldShow(true);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("onboarding:reset"));
    }
  };

  return { shouldShow, completeOnboarding, resetOnboarding };
}

export default function Onboarding() {
  const { shouldShow, completeOnboarding } = useOnboarding();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (shouldShow) {
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [shouldShow]);

  useEffect(() => {
    const handle = () => {
      setIsOpen(true);
      setShowTour(false);
      setCurrentStep(0);
    };
    window.addEventListener("onboarding:reset", handle);
    return () => window.removeEventListener("onboarding:reset", handle);
  }, []);

  const handleSkip = () => {
    setIsOpen(false);
    completeOnboarding();
  };

  const startTour = () => {
    setShowTour(true);
    setCurrentStep(0);
  };

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const finish = () => {
    setIsOpen(false);
    completeOnboarding();
    if (typeof window !== "undefined") {
      window.location.href = "/";
    } else {
      router.push("/");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/95 backdrop-blur-md transition-opacity duration-300"
        onClick={handleSkip}
      />

      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[#E2E5E9]/10 bg-[#14151a] p-8 shadow-2xl"
        style={{ animation: "modalIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {!showTour ? (
          <div className="text-center">
            <div className="mb-6 flex items-center justify-center gap-3">
              <img src={LOGO_MARK} alt="WiseOS" className="h-12 w-auto object-contain" />
              <span className="text-2xl font-semibold tracking-tight text-[#E2E5E9]">WiseOS</span>
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-[#E2E5E9]">
              Välkommen till WiseOS
            </h1>
            <p className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-[#8a8f96]">
              En AI-driven rättningsassistent byggd för svenska lärare. Här är en snabb rundtur.
            </p>

            <div className="mt-10 flex flex-col gap-3">
              <button
                onClick={startTour}
                className="w-full rounded-full bg-[#ea580c] px-6 py-3 text-sm font-semibold text-white transition-all hover:shadow-[0_0_24px_-4px_rgba(234,88,12,0.45)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Starta rundturen
              </button>
              <button
                onClick={handleSkip}
                className="w-full rounded-full border border-[#E2E5E9]/10 bg-transparent px-6 py-3 text-sm font-medium text-[#8a8f96] transition-all hover:bg-[#E2E5E9]/5 hover:text-[#E2E5E9]"
              >
                Hoppa över
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col" style={{ animation: "stepIn 0.3s ease-out" }}>
            <div className="mb-5 flex items-center justify-between text-xs font-medium uppercase tracking-widest text-[#8a8f96]">
              <span className="text-[#ea580c]">Rundtur</span>
              <span>
                Steg {currentStep + 1} av {steps.length}
              </span>
            </div>

            <div className="mb-6 flex justify-center gap-2">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep ? "w-8 bg-[#ea580c]" : "w-2 bg-[#E2E5E9]/15"
                  }`}
                />
              ))}
            </div>

            <StepVisual step={currentStep} />

            <h2 className="text-2xl font-bold tracking-tight text-[#E2E5E9]">
              {steps[currentStep].title}
            </h2>
            <p className="mx-auto mt-3 max-w-[360px] text-[15px] leading-relaxed text-[#8a8f96]">
              {steps[currentStep].description}
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <div className="flex gap-3">
                {currentStep > 0 && (
                  <button
                    onClick={goPrev}
                    className="flex-1 rounded-full border border-[#E2E5E9]/10 bg-transparent px-4 py-3 text-sm font-medium text-[#8a8f96] transition-all hover:bg-[#E2E5E9]/5 hover:text-[#E2E5E9]"
                  >
                    Föregående
                  </button>
                )}
                {currentStep < steps.length - 1 ? (
                  <button
                    onClick={goNext}
                    className="flex-1 rounded-full bg-[#ea580c] px-4 py-3 text-sm font-semibold text-white transition-all hover:shadow-[0_0_24px_-4px_rgba(234,88,12,0.45)] active:scale-[0.98]"
                  >
                    Nästa
                  </button>
                ) : (
                  <button
                    onClick={finish}
                    className="flex-1 rounded-full bg-[#ea580c] px-4 py-3 text-sm font-semibold text-white transition-all hover:shadow-[0_0_24px_-4px_rgba(234,88,12,0.45)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Gå till dashboarden
                  </button>
                )}
              </div>
              <button
                onClick={handleSkip}
                className="w-full py-2 text-[12.5px] text-[#8a8f96] transition-colors hover:text-[#E2E5E9]"
              >
                Hoppa över introduktionen
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes modalIn {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes stepIn {
          from {
            opacity: 0;
            transform: translateX(12px);
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
