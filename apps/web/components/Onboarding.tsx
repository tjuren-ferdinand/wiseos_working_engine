"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Logo from "@/components/Logo";
import LineIcon from "./LineIcon";

const ONBOARDING_KEY = "wiseos_onboarding_completed";

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
      <div className="mb-6 overflow-hidden rounded-2xl border border-ink-hairline/10 bg-paper-raised p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-ink" />
          <div className="h-2 w-20 rounded bg-ink/10" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="h-14 rounded-xl bg-ink/5 p-2">
            <div className="text-[9px] text-ink-secondary">Prov</div>
            <div className="text-sm font-medium text-ink">12</div>
          </div>
          <div className="h-14 rounded-xl bg-ink/5 p-2">
            <div className="text-[9px] text-ink-secondary">Tid sparad</div>
            <div className="text-sm font-medium text-ink">4h</div>
          </div>
          <div className="h-14 rounded-xl bg-ink/5 p-2">
            <div className="text-[9px] text-ink-secondary">AI-rättat</div>
            <div className="text-sm font-medium text-ink">89</div>
          </div>
        </div>
        <div className="mt-3 h-2 w-full rounded bg-ink/5" />
        <div className="mt-2 h-2 w-5/6 rounded bg-ink/5" />
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
            className="flex items-center gap-3 rounded-2xl border border-ink-hairline/10 bg-paper-raised p-3"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink/5 text-ink">
              <LineIcon name="graduation-cap" className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-ink">{c.name}</div>
              <div className="text-[11px] text-ink-secondary">{c.count}</div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="mb-6 rounded-2xl border border-dashed border-ink-hairline/15 bg-paper-raised p-5 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-ink/5 text-ink-secondary">
          <LineIcon name="upload" className="h-6 w-6" />
        </div>
        <div className="mt-3 text-sm font-medium text-ink">Dra hit elevprov</div>
        <div className="mt-1 text-[11px] text-ink-secondary">PDF eller bilder</div>
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-[10px] bg-ink px-4 py-1.5 text-[11px] font-medium text-paper">
          <LineIcon name="play" className="h-3 w-3" />
          Starta rättning
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-ink-hairline/10 bg-paper-raised p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-ink">Elev: Erik Svensson</div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/5 text-ink-secondary">
          <LineIcon name="check" className="h-3.5 w-3.5" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-2 w-full rounded bg-ink/5" />
        <div className="h-2 w-5/6 rounded bg-ink/5" />
        <div className="h-2 w-4/6 rounded bg-ink/5" />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-ink/5 p-2">
        <span className="text-[11px] text-ink-secondary">Poäng</span>
        <span className="text-sm font-medium text-ink">18/20</span>
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

  const completeOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setShouldShow(false);
  }, []);

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

  const [isOpen, setIsOpen] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (shouldShow) {
      const timer = setTimeout(() => setIsOpen(true), 600);
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

  const handleSkip = useCallback(() => {
    setIsOpen(false);
    completeOnboarding();
  }, [completeOnboarding]);

  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        handleSkip();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.tabIndex >= 0 && element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) {
        event.preventDefault();
        dialog.focus();
      } else if (!controls.includes(document.activeElement as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target)) {
        dialog.focus({ preventScroll: true });
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn);
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen, handleSkip]);

  useEffect(() => {
    if (isOpen) dialogRef.current?.focus({ preventScroll: true });
  }, [isOpen, showTour, currentStep]);

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
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop — subtle, not opaque */}
      <div
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        aria-hidden="true"
        onClick={handleSkip}
      />

      {/* Slide-in panel from right */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="fixed right-0 top-0 z-[10000] flex h-dvh w-full max-w-lg flex-col overflow-y-auto overscroll-contain border-l border-ink-hairline/10 bg-paper-elevated p-8 pb-[max(2rem,env(safe-area-inset-bottom))] pr-[max(2rem,env(safe-area-inset-right))] pt-[max(2rem,env(safe-area-inset-top))] shadow-2xl outline-none"
        style={{ animation: "slideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1)" }}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          type="button"
          className="btn-tertiary absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] h-11 w-11 p-0"
          aria-label="Stäng"
        >
          <LineIcon name="x" className="h-4 w-4" />
        </button>

        {!showTour ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="mb-6 flex items-center justify-center gap-3">
              <Logo className="h-12 w-auto object-contain" />
              <span className="text-2xl font-medium tracking-tight text-ink">WiseOS</span>
            </div>

            <h1 id={titleId} className="text-2xl font-medium tracking-tight text-ink">
              Välkommen till WiseOS
            </h1>
            <p id={descriptionId} className="mx-auto mt-4 max-w-xs text-[15px] leading-relaxed text-ink-secondary">
              En AI-driven rättningsassistent byggd för svenska lärare. Här är en snabb rundtur.
            </p>

            <div className="mt-10 flex w-full max-w-xs flex-col gap-3">
              <button
                onClick={startTour}
                type="button"
                className="btn-primary w-full px-6 py-3"
              >
                Starta rundturen
              </button>
              <button
                onClick={handleSkip}
                type="button"
                className="btn-secondary w-full px-6 py-3"
              >
                Hoppa över
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col" style={{ animation: "stepIn 0.3s ease-out" }}>
            <div className="mb-5 flex items-center justify-between text-xs font-medium uppercase tracking-[0.12em] text-ink-secondary">
              <span className="text-ink-secondary">Rundtur</span>
              <span>
                Steg {currentStep + 1} av {steps.length}
              </span>
            </div>

            <div className="mb-6 flex justify-center gap-2">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep ? "w-8 bg-ink" : "w-2 bg-ink/15"
                  }`}
                />
              ))}
            </div>

            <StepVisual step={currentStep} />

            <h2 id={titleId} className="text-xl font-medium tracking-tight text-ink">
              {steps[currentStep].title}
            </h2>
            <p id={descriptionId} className="mt-3 max-w-[360px] text-[15px] leading-relaxed text-ink-secondary">
              {steps[currentStep].description}
            </p>

            <div className="mt-auto flex flex-col gap-3 pt-8">
              <div className="flex gap-3">
                {currentStep > 0 && (
                  <button
                    onClick={goPrev}
                    type="button"
                    className="btn-secondary flex-1 px-4 py-3"
                  >
                    Föregående
                  </button>
                )}
                {currentStep < steps.length - 1 ? (
                  <button
                    onClick={goNext}
                    type="button"
                    className="btn-primary flex-1 px-4 py-3"
                  >
                    Nästa
                  </button>
                ) : (
                  <button
                    onClick={finish}
                    type="button"
                    className="btn-primary flex-1 px-4 py-3"
                  >
                    Klar
                  </button>
                )}
              </div>
              <button
                onClick={handleSkip}
                type="button"
                className="btn-secondary w-full py-2 text-[12.5px]"
              >
                Hoppa över
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @media (prefers-reduced-motion: reduce) {
          [role="dialog"], [role="dialog"] div { animation: none !important; }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
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
    </>,
    document.body,
  );
}
