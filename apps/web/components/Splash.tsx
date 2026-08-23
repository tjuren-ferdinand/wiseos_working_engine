"use client";

import { useEffect, useState } from "react";
import WiseOSIcon from "@/experimental-ui/components/WiseOSIcon";

const SESSION_KEY = "wiseos_arc_splash_shown";

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
    }, 2600);

    const revealTimer = setTimeout(() => {
      setMainReveal(true);
    }, 2700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(revealTimer);
      document.body.style.overflow = "auto";
    };
  }, []);

  const logoText = "WISEOS";

  return (
    <>
      {show && (
        <div className={`arc-splash ${fadeOut ? "arc-fade-out" : ""}`}>
          <div className="flex flex-col items-center justify-center gap-5">
            <WiseOSIcon className="w-36 h-36" />
            <h1 className="wise-splash-title">
              {logoText.split("").map((char, i) => (
                <span
                  key={i}
                  className="wise-splash-letter"
                  style={{ animationDelay: `${1.0 + i * 0.08}s` }}
                >
                  {char}
                </span>
              ))}
            </h1>
          </div>
        </div>
      )}
      <div className={`arc-main ${mainReveal ? "arc-reveal" : ""}`}>
        {children}
      </div>
    </>
  );
}
