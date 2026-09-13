"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LineIcon from "./LineIcon";

/**
 * Inbyggt dokumentskanningsverktyg — live kameravy via getUserMedia med
 * automatisk sidtagning. Producerar vanliga JPEG-File-objekt som matas in
 * i samma addFiles()-flöde som filväljaren — noll koppling till backend.
 *
 * Auto-capture kör på en liten analys-canvas (~160 px) så att loopen är
 * billig även på svaga mobiler. Två signaler måste hålla i sig ~600 ms:
 *   1. Stabilitet  — låg pixel-diff mot förra analysen (pappret ligger stilla)
 *   2. Dokumentnärvaro — tillräcklig kantdensitet + ljusandel inom guiden
 * Efter varje tagning krävs en tydlig scenförändring (nytt papper lyfts in)
 * innan nästa auto-skott — förhindrar dubbletter av samma sida.
 */

// --- Trösklar (0–255-skala på 160px-analys) -------------------------------
const ANALYSIS_W = 160;
const TICK_MS = 150;
const MOTION_MAX = 5;          // medel luma-diff som räknas som "stilla"
const STABLE_TICKS = 4;        // 4 × 150 ms ≈ 600 ms stabilitet krävs
const EDGE_MIN = 0.012;        // minst 1.2 % av guidepixlarna är kanter
const BRIGHT_MIN = 0.12;       // minst 12 % ljusa pixlar (pappertendens)
const REARM_MOTION = 16;       // scenförändring som återaktiverar auto-skott
const COOLDOWN_MS = 1100;      // paus efter varje tagning
const MAX_EDGE_PX = 1920;      // långsidan beskärs till max denna storlek
const JPEG_QUALITY = 0.88;

// Guide-boxens andel av analysytan (matchar den visuella ramen på skärmen)
const GUIDE = { x0: 0.12, x1: 0.88, y0: 0.16, y1: 0.84 };

interface CapturedPage {
  blob: Blob;
  url: string;
  name: string;
}

type ScanStatus = "searching" | "holding" | "captured";

export default function DocumentScanner({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (files: File[]) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisRef = useRef<HTMLCanvasElement | null>(null);
  const prevLumaRef = useRef<Float32Array | null>(null);
  const timerRef = useRef<number | null>(null);
  const stableCountRef = useRef(0);
  const armedRef = useRef(true);
  const cooldownUntilRef = useRef(0);
  const counterRef = useRef(0);
  const busyRef = useRef(false);
  const statusHoldUntilRef = useRef(0);

  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [status, setStatus] = useState<ScanStatus>("searching");
  const [flash, setFlash] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const stopStream = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    prevLumaRef.current = null;
    stableCountRef.current = 0;
    armedRef.current = true;
    busyRef.current = false;
  }, []);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busyRef.current || video.readyState < 2) return;
    busyRef.current = true;
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(vw, vh));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      if (!blob) return;
      counterRef.current += 1;
      // Tidsstämpel i namnet: garanterar unika filnamn även över flera
      // skanningsessioner (BatchGradingPipeline mappar resultat på f.name).
      const n = String(counterRef.current).padStart(2, "0");
      const name = `scan-${Date.now().toString(36)}-${n}.jpg`;
      setPages((prev) => [
        ...prev,
        { blob, url: URL.createObjectURL(blob), name },
      ]);
      setStatus("captured");
      statusHoldUntilRef.current = Date.now() + 900;
      setFlash(true);
      window.setTimeout(() => setFlash(false), 260);
      cooldownUntilRef.current = Date.now() + COOLDOWN_MS;
      armedRef.current = false; // kräv ny scen innan nästa auto-skott
    } finally {
      busyRef.current = false;
    }
  }, []);

  /** Analyserar en nedskalad frame: motion + kantdensitet + ljusandel. */
  const analyseTick = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || !video.videoWidth) return;

    const aspect = video.videoHeight / video.videoWidth;
    const w = ANALYSIS_W;
    const h = Math.max(1, Math.round(w * aspect));
    if (!analysisRef.current) {
      analysisRef.current = document.createElement("canvas");
    }
    const canvas = analysisRef.current;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // Luma-array
    const luma = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const o = i * 4;
      luma[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
    }

    // Begränsa analysen till guide-boxen
    const gx0 = Math.floor(w * GUIDE.x0);
    const gx1 = Math.ceil(w * GUIDE.x1);
    const gy0 = Math.floor(h * GUIDE.y0);
    const gy1 = Math.ceil(h * GUIDE.y1);

    let edgeCount = 0;
    let brightCount = 0;
    let motionSum = 0;
    let counted = 0;
    const prev = prevLumaRef.current;
    const sameSize = prev !== null && prev.length === luma.length;

    for (let y = gy0 + 1; y < gy1 - 1; y++) {
      for (let x = gx0 + 1; x < gx1 - 1; x++) {
        const i = y * w + x;
        const g =
          Math.abs(luma[i + 1] - luma[i - 1]) +
          Math.abs(luma[i + w] - luma[i - w]);
        if (g > 48) edgeCount++;
        if (luma[i] > 150) brightCount++;
        if (sameSize) motionSum += Math.abs(luma[i] - prev[i]);
        counted++;
      }
    }

    const motion = sameSize && counted ? motionSum / counted : 999;
    const edgeRatio = counted ? edgeCount / counted : 0;
    const brightRatio = counted ? brightCount / counted : 0;
    prevLumaRef.current = luma;

    const now = Date.now();
    const documentLikely = edgeRatio > EDGE_MIN && brightRatio > BRIGHT_MIN;

    // Återaktivering: en tydlig scenförändring (nytt papper/lyft) låser upp.
    if (!armedRef.current && motion > REARM_MOTION) {
      armedRef.current = true;
    }

    if (motion < MOTION_MAX) {
      stableCountRef.current += 1;
    } else {
      stableCountRef.current = 0;
    }
    const stable = stableCountRef.current >= STABLE_TICKS;

    // Statusvakt via ref — intervallet fångar en stabil closure, så
    // status kan inte läsas från state här. "captured" hålls kvar i
    // statusHoldUntilRef millisekunder så bekräftelsen syns.
    if (now > statusHoldUntilRef.current) {
      setStatus(documentLikely && stableCountRef.current > 0 ? "holding" : "searching");
    }

    if (
      documentLikely &&
      stable &&
      armedRef.current &&
      now > cooldownUntilRef.current
    ) {
      void captureFrame();
    }
  }, [captureFrame]);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
      } catch {
        // Desktop-webbkameror stödjer inte alltid facingMode — försök utan.
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      timerRef.current = window.setInterval(analyseTick, TICK_MS);
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("denied");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("nocamera");
      } else if (name === "NotReadableError") {
        setError("busy");
      } else {
        setError("generic");
      }
    }
  }, [analyseTick]);

  // Öppna/stäng-livscykel — nollställ allt sessionstillstånd vid öppning
  // så att gamla thumbnails/räknare inte hänger kvar.
  useEffect(() => {
    if (open) {
      setPages((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
      counterRef.current = 0;
      statusHoldUntilRef.current = 0;
      setConfirmDiscard(false);
      setStatus("searching");
      setFlash(false);
      void startCamera();
      return stopStream;
    }
    return undefined;
  }, [open, startCamera, stopStream]);

  // Städa object-URLs vid unmount
  useEffect(
    () => () => {
      pages.forEach((p) => URL.revokeObjectURL(p.url));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!open) return null;

  const removePage = (index: number) => {
    setPages((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  };

  const handleDone = () => {
    const files = pages.map(
      (p) => new File([p.blob], p.name, { type: "image/jpeg" }),
    );
    onDone(files);
  };

  const handleClose = () => {
    if (pages.length > 0 && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  };

  const statusText =
    status === "captured"
      ? `Sida ${pages.length} sparad`
      : status === "holding"
        ? "Dokument hittat — håll stilla"
        : "Sikta mot en provsida";

  const errorText: Record<string, { title: string; body: string }> = {
    denied: {
      title: "Kamerabehörighet nekades",
      body: "Tillåt kameraåtkomst i webbläsarens inställningar för den här sidan och försök igen.",
    },
    nocamera: {
      title: "Ingen kamera hittades",
      body: "Enheten verkar sakna en fungerande kamera. Använd filväljaren istället.",
    },
    busy: {
      title: "Kameran är upptagen",
      body: "En annan app eller flik använder kameran just nu. Stäng den och försök igen.",
    },
    unsupported: {
      title: "Kameran stöds inte här",
      body: "Den här webbläsaren eller kontexten stödjer inte kameraåtkomst. Använd filväljaren istället.",
    },
    generic: {
      title: "Kunde inte starta kameran",
      body: "Ett oväntat fel uppstod. Försök igen eller använd filväljaren.",
    },
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white">
      {/* Live-vy */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Blixt vid tagning */}
      <div
        className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${
          flash ? "opacity-70" : "opacity-0"
        }`}
      />

      {/* Guide-ram */}
      {!error && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div
            className={`relative h-[62%] w-[76%] max-w-md rounded-2xl border-2 transition-colors duration-200 ${
              status === "holding"
                ? "border-emerald-400"
                : status === "captured"
                  ? "border-white"
                  : "border-white/50"
            }`}
          >
            {/* Hörnmarkörer */}
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-2xl",
              "right-0 top-0 border-r-4 border-t-4 rounded-tr-2xl",
              "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-2xl",
              "right-0 bottom-0 border-r-4 border-b-4 rounded-br-2xl",
            ].map((cls) => (
              <span
                key={cls}
                className={`absolute h-7 w-7 border-white/90 ${cls}`}
              />
            ))}
            {status === "captured" && (
              <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-emerald-500 text-white">
                <LineIcon name="check" className="h-7 w-7" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Topp-bar: status + stäng */}
      <div className="relative flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <span
          className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium backdrop-blur transition-colors ${
            status === "captured"
              ? "bg-emerald-500/90"
              : status === "holding"
                ? "bg-emerald-500/80"
                : "bg-black/45"
          }`}
        >
          {error ? "Kameran kunde inte startas" : statusText}
        </span>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Stäng skannern"
          className="grid h-10 w-10 place-items-center rounded-full bg-black/45 backdrop-blur transition-colors hover:bg-black/60"
        >
          <LineIcon name="x" className="h-5 w-5" />
        </button>
      </div>

      {/* Felvy */}
      {error && (
        <div className="relative mx-4 mt-6 rounded-2xl bg-black/70 p-5 backdrop-blur">
          <div className="text-base font-semibold">{errorText[error].title}</div>
          <p className="mt-1.5 text-sm leading-relaxed text-white/80">
            {errorText[error].body}
          </p>
          {error !== "unsupported" && (
            <button
              type="button"
              onClick={() => void startCamera()}
              className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black"
            >
              Försök igen
            </button>
          )}
        </div>
      )}

      {/* Botten: thumbnails + slutare + klar */}
      <div className="relative mt-auto bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
        {confirmDiscard && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-black/70 px-4 py-3 backdrop-blur">
            <span className="text-sm">Släng {pages.length} skannade sidor?</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-semibold"
              >
                Släng
              </button>
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-semibold"
              >
                Fortsätt
              </button>
            </div>
          </div>
        )}

        {/* Thumbnail-strip */}
        {pages.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {pages.map((p, i) => (
              <div key={p.url} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={`Skannad sida ${i + 1}`}
                  className="h-16 w-12 rounded-lg border border-white/25 object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePage(i)}
                  aria-label={`Ta bort sida ${i + 1}`}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/80 text-white ring-1 ring-white/30"
                >
                  <LineIcon name="x" className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="w-16 text-sm font-medium text-white/80">
            {pages.length > 0 ? `${pages.length} sidor` : ""}
          </div>

          {/* Manuell slutare — alltid tillgänglig som backup */}
          <button
            type="button"
            onClick={() => void captureFrame()}
            disabled={!!error}
            aria-label="Ta bild"
            className="grid h-[68px] w-[68px] place-items-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-90 disabled:opacity-40"
          >
            <span className="h-12 w-12 rounded-full bg-white" />
          </button>

          <button
            type="button"
            onClick={handleDone}
            className="w-16 rounded-xl bg-white px-0 py-2.5 text-center text-sm font-semibold text-black disabled:opacity-40"
          >
            Klar
          </button>
        </div>
      </div>
    </div>
  );
}
