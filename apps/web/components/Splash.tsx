"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from "framer-motion";
import { useTheme } from "@/lib/theme";
import { LOGO_MARK_DARK, LOGO_MARK_LIGHT } from "@/lib/logo";

const SESSION_KEY = "wiseos_arc_splash_shown";

export default function Splash({ children }: { children: React.ReactNode }) {
  const [show, setShowState] = useState(false);
  const showRef = useRef(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [mainReveal, setMainReveal] = useState(false);
  const [skip, setSkip] = useState(false);
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? LOGO_MARK_DARK : LOGO_MARK_LIGHT;

  const progress = useMotionValue(0);
  const progressWidth = useTransform(progress, (v) => `${v}%`);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Only show the splash on the login page
    if (window.location.pathname !== "/login") {
      setSkip(true);
      setMainReveal(true);
      return;
    }

    const alreadyShown = sessionStorage.getItem(SESSION_KEY);
    if (alreadyShown) {
      setSkip(true);
      setMainReveal(true);
      return;
    }

    const start = performance.now();
    const delay = 300; // only show loader if loading takes more than 300ms
    const max = 1500;  // hard cap at 1.5s

    const setShow = (val: boolean) => {
      showRef.current = val;
      setShowState(val);
    };

    let delayTimer: number;
    let maxTimer: number;
    let controls: ReturnType<typeof animate> | null = null;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(delayTimer);
      window.clearTimeout(maxTimer);
      window.removeEventListener("load", onReady);
      if (controls) controls.stop();

      if (showRef.current) {
        // Complete the progress bar and crossfade out
        progress.set(100);
        document.body.style.overflow = "auto";
        setFadeOut(true);
        setMainReveal(true);
        setTimeout(() => {
          sessionStorage.setItem(SESSION_KEY, "1");
        }, 350);
      } else {
        setMainReveal(true);
        sessionStorage.setItem(SESSION_KEY, "1");
      }
    };

    const onReady = () => finish();

    if (document.readyState === "complete") {
      finish();
      return;
    }

    window.addEventListener("load", onReady);

    delayTimer = window.setTimeout(() => {
      if (finished) return;
      document.body.style.overflow = "hidden";
      setShow(true);
      controls = animate(progress, 100, {
        duration: (max - delay) / 1000,
        ease: "linear",
      });
    }, delay);

    maxTimer = window.setTimeout(() => {
      finish();
    }, max);

    return () => {
      window.clearTimeout(delayTimer);
      window.clearTimeout(maxTimer);
      window.removeEventListener("load", onReady);
      if (controls) controls.stop();
      document.body.style.overflow = "auto";
    };
  }, [progress]);

  const logoText = "WiseOS";

  return (
    <>
      <AnimatePresence>
        {show && !fadeOut && (
          <motion.div
            key="splash"
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
            style={{
              background:
                "radial-gradient(120% 120% at 50% 30%, rgb(var(--surface-2)) 0%, rgb(var(--background)) 60%, rgb(var(--surface)) 100%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02, filter: "blur(8px)" }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Ambient glow behind mark */}
            <motion.div
              className="absolute h-[420px] w-[420px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle, rgb(var(--accent) / 0.16) 0%, transparent 70%)",
              }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />

            <div className="relative flex flex-col items-center gap-5">
              {/* Logo mark with a soft breathing pulse */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              >
                <motion.img
                  src={logoSrc}
                  alt="WiseOS"
                  className="h-24 w-auto max-w-[220px] object-contain select-none"
                  style={{ filter: "drop-shadow(0 0 26px rgb(var(--accent) / 0.35))" }}
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                />
              </motion.div>

              {/* Progress bar replacing the hairline divider */}
              <div className="h-[2px] w-56 overflow-hidden rounded-full bg-ink/10">
                <motion.div
                  className="h-full bg-ink/70"
                  style={{ width: progressWidth }}
                />
              </div>

              {/* Wordmark with heading tracking scale */}
              <motion.h1
                className="text-[28px] font-semibold tracking-tight uppercase text-ink"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {logoText}
              </motion.h1>

              <motion.p
                className="text-[12px] tracking-wider uppercase text-ink-secondary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                AI-driven rättning
              </motion.p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={skip ? "" : `arc-main ${mainReveal ? "arc-reveal" : ""}`}>
        {children}
      </div>
    </>
  );
}
