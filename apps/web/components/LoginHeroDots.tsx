"use client";

/**
 * Dense dot-grid canvas background — identisk med DotGrid i GradingFlowScene.tsx.
 * Tema-anpassad via CSS-variabler, ingen animation, ingen SVG.
 */
export default function LoginHeroDots({ className = "" }: { className?: string }) {
  return (
    <div className={`relative isolate aspect-[16/10] w-full overflow-hidden rounded-2xl ${className}`} aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgb(var(--foreground) / 0.10) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgb(var(--background) / 0.9) 100%)",
        }}
      />
    </div>
  );
}
