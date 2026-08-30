"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/lib/theme";
import { LOGO_MARK_DARK, LOGO_MARK_LIGHT } from "@/lib/logo";

const SESSION_KEY = "wiseos_arc_splash_shown";

export default function Splash({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [mainReveal, setMainReveal] = useState(false);
  const [skip, setSkip] = useState(false);
  const { theme } = useTheme();
  const logoSrc = theme === "dark" ? LOGO_MARK_DARK : LOGO_MARK_LIGHT;

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(SESSION_KEY);
    if (alreadyShown) {
      setSkip(true);
      setMainReveal(true);
      return;
    }

    setShow(true);
    document.body.style.overflow = "hidden";

    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
      document.body.style.overflow = "auto";
      sessionStorage.setItem(SESSION_KEY, "1");
    }, 2400);

    const revealTimer = setTimeout(() => {
      setMainReveal(true);
    }, 2750);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(revealTimer);
      document.body.style.overflow = "auto";
    };
  }, []);

  const logoText = "WiseOS";

  return (
    <>
      <AnimatePresence>
        {show && !fadeOut && (
          <motion.div
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
            style={{ background: "radial-gradient(120% 120% at 50% 30%, rgb(var(--surface-2)) 0%, rgb(var(--surface)) 60%, rgb(var(--background)) 100%)" }}
            exit={{ opacity: 0, scale: 1.06, filter: "blur(6px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Ambient glow behind mark */}
            <motion.div
              className="absolute h-[420px] w-[420px] rounded-full"
              style={{
                background: "radial-gradient(circle, rgb(var(--accent) / 0.16) 0%, transparent 70%)",
              }}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />

            <div className="relative flex flex-col items-center gap-6">
              {/* Mark: spins in from a sliver, settles with a soft overshoot */}
              <motion.img
                src={logoSrc}
                alt="WiseOS"
                className="h-24 w-auto max-w-[220px] object-contain select-none"
                style={{ filter: "drop-shadow(0 0 26px rgb(var(--accent) / 0.35))" }}
                initial={{ opacity: 0, scale: 0.35, rotate: -130 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              />

              {/* Hairline that draws under the wordmark */}
              <motion.div
                className="h-px bg-gradient-to-r from-transparent via-ink/70 to-transparent"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 220, opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.6, ease: "easeOut" }}
              />

              {/* Wordmark — staggered letter reveal */}
              <h1 className="flex text-[28px] font-semibold tracking-[0.24em] uppercase text-ink">
                {logoText.split("").map((char, i) => (
                  <motion.span
                    key={i}
                    className="inline-block"
                    style={{ minWidth: char === " " ? "0.4em" : undefined }}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.65 + i * 0.055, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {char}
                  </motion.span>
                ))}
              </h1>

              <motion.p
                className="text-[12px] tracking-[0.18em] uppercase text-ink-secondary"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.15, duration: 0.5 }}
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
