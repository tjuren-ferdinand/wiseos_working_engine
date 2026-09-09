"use client";

import { useEffect, useState } from "react";

const COLS = 6;
const ROWS = 4;
const TOTAL = COLS * ROWS;

export default function LoginHeroPaperGrid({ className = "" }: { className?: string }) {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div
      className={`relative isolate aspect-[4/3] w-full overflow-hidden rounded-2xl ${className}`}
      aria-hidden
      style={{ perspective: "1200px" }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgb(var(--background) / 0.85) 100%)",
        }}
      />

      <div
        className="grid h-full w-full content-center justify-center gap-3 p-8"
        style={{
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          maxWidth: "560px",
          margin: "0 auto",
        }}
      >
        {Array.from({ length: TOTAL }, (_, i) => {
          const col = i % COLS;
          const row = Math.floor(i / COLS);
          const lift = (i % 5 === 0) || (i % 7 === 0); // every 5th and 7th paper lifts
          const delay = (col + row) * 0.4 + (lift ? i * 0.15 : 0);

          return (
            <div
              key={i}
              className="relative h-full w-full"
              style={{
                transformStyle: "preserve-3d",
                transformOrigin: "center bottom",
              }}
            >
              <div
                className="absolute inset-0 rounded-md"
                style={{
                  background: "rgb(var(--surface-elevated))",
                  boxShadow:
                    "0 2px 6px rgb(var(--foreground) / 0.04), 0 1px 2px rgb(var(--foreground) / 0.03)",
                  opacity: reduce ? 0.85 : 1,
                  transform: reduce ? "rotateX(0)" : undefined,
                  transformOrigin: "center bottom",
                  animation: reduce
                    ? "none"
                    : lift
                    ? `paperLift 10s cubic-bezier(0.25, 0.1, 0.25, 1) ${delay}s infinite`
                    : "none",
                }}
              >
                {/* Fold seam shadow */}
                {lift && !reduce && (
                  <div
                    className="absolute inset-x-0 top-1/2 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgb(var(--foreground) / 0.06), transparent)",
                      transform: "translateY(-50%)",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes paperLift {
          0%, 10% {
            transform: translateZ(0) rotateX(0) rotateY(0) translateY(0);
            box-shadow: 0 2px 6px rgb(var(--foreground) / 0.04), 0 1px 2px rgb(var(--foreground) / 0.03);
            opacity: 1;
          }
          30% {
            transform: translateZ(28px) rotateX(-18deg) rotateY(4deg) translateY(-10px);
            box-shadow: 0 20px 40px rgb(var(--foreground) / 0.08);
            opacity: 0.95;
          }
          55% {
            transform: translateZ(70px) rotateX(-42deg) rotateY(10deg) translateY(-36px);
            box-shadow: 0 32px 70px rgb(var(--foreground) / 0.10);
            opacity: 0.80;
          }
          80%, 100% {
            transform: translateZ(150px) rotateX(-78deg) rotateY(22deg) translateY(-100px);
            box-shadow: 0 60px 100px rgb(var(--foreground) / 0.12);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
