"use client";

import { useEffect, useState } from "react";

const SESSION_KEY = "wiseos_arc_splash_shown";

/**
 * Arc intro splash — first-load only per browser session.
 * Mirrors the NobleArc splash storyboard (gradient wordmark -> fade -> reveal),
 * re-themed to WiseOS's light/beige "Arc" palette.
 */
export default function Splash({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [mainReveal, setMainReveal] = useState(false);

  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(SESSION_KEY);
    if (alreadyShown) {
      setMainReveal(true);
      return;
    }

    setShow(true);
    document.body.style.overflow = "hidden";

    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
      document.body.style.overflow = "auto";
      sessionStorage.setItem(SESSION_KEY, "1");
    }, 1800);

    const revealTimer = setTimeout(() => {
      setMainReveal(true);
    }, 2150);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(revealTimer);
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <>
      {show && (
        <div className={`arc-splash ${fadeOut ? "arc-fade-out" : ""}`}>
          <h1 className="arc-splash-text">WiseOS</h1>
        </div>
      )}
      <div className={`arc-main ${mainReveal ? "arc-reveal" : ""}`}>
        {children}
      </div>
    </>
  );
}
