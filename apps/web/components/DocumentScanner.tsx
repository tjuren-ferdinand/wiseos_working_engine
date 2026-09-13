"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
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
const THUMB_PX = 240;          // thumbnails lagras nedskalade — full-res <img>
                               // i DOM:en håller ~11 MB avkodad bitmapp per
                               // sida och kan döda fliken under iOS.
const JPEG_QUALITY = 0.88;

// Guide-boxens andel av analysytan (matchar den visuella ramen på skärmen)
const GUIDE = { x0: 0.12, x1: 0.88, y0: 0.16, y1: 0.84 };

interface CapturedPage {
  blob: Blob;
  url: string;   // nedskalad thumbnail — aldrig full-res i DOM:en
  name: string;
  group: number; // elevgrupp — sätts av "Nästa elev"-knappen
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
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevLumaRef = useRef<Float32Array | null>(null);
  const timerRef = useRef<number | null>(null);
  const stableCountRef = useRef(0);
  const armedRef = useRef(true);
  const cooldownUntilRef = useRef(0);
  const counterRef = useRef(0);
  const busyRef = useRef(false);
  const statusHoldUntilRef = useRef(0);
  const groupRef = useRef(1);
  const startCameraRef = useRef<(() => Promise<void>) | null>(null);
  const listenersRef = useRef<{
    track?: MediaStreamTrack;
    onEnded?: () => void;
    onPause?: () => void;
    onVis?: () => void;
  }>({});

  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [status, setStatus] = useState<ScanStatus>("searching");
  const [flash, setFlash] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [groupCount, setGroupCount] = useState(1);
  const [elevNotice, setElevNotice] = useState<number | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  // Fas "facit": läraren skannar provets frågeblad/facit först (grupp 0,
  // filnamnsmarkör e00) — hårt åtskilt från elevgrupperna i pipelinen.
  const [phase, setPhase] = useState<"facit" | "elever">("facit");

  const stopStream = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const L = listenersRef.current;
    L.track?.removeEventListener("ended", L.onEnded!);
    if (L.onPause && videoRef.current) {
      videoRef.current.removeEventListener("pause", L.onPause);
    }
    if (L.onVis) {
      document.removeEventListener("visibilitychange", L.onVis);
    }
    listenersRef.current = {};
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
      // Återanvänd samma canvas — en ny ~8 MB-allokering per tagning är
      // onödig minnespress på iOS där fliken kan laddas om under tryck.
      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement("canvas");
      }
      const canvas = captureCanvasRef.current;
      canvas.width = Math.round(vw * scale);
      canvas.height = Math.round(vh * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      if (!blob) return;
      // Nedskalad thumbnail till remsan. Visas aldrig full-res-blobben —
      // avkodade bitmappar staplas annars och kan trigga sidomladdning.
      if (!thumbCanvasRef.current) {
        thumbCanvasRef.current = document.createElement("canvas");
      }
      const thumb = thumbCanvasRef.current;
      const tScale = Math.min(1, THUMB_PX / Math.max(canvas.width, canvas.height));
      thumb.width = Math.max(1, Math.round(canvas.width * tScale));
      thumb.height = Math.max(1, Math.round(canvas.height * tScale));
      const tCtx = thumb.getContext("2d");
      if (!tCtx) return;
      tCtx.drawImage(canvas, 0, 0, thumb.width, thumb.height);
      const thumbBlob = await new Promise<Blob | null>((resolve) =>
        thumb.toBlob(resolve, "image/jpeg", 0.7),
      );
      if (!thumbBlob) return;
      counterRef.current += 1;
      // Filnamn: scan-<session>-e<elevgrupp>-<sida>.jpg. Tidsstämpeln ger
      // unika namn över sessioner (pipeline mappar resultat på f.name) och
      // eNN-markören är en explicit elevgräns som batch-pipelinen läser
      // som hård segmentgräns — sidor i olika grupper slås aldrig ihop.
      const n = String(counterRef.current).padStart(2, "0");
      const g = String(groupRef.current).padStart(2, "0");
      const name = `scan-${Date.now().toString(36)}-e${g}-${n}.jpg`;
      setPages((prev) => [
        ...prev,
        { blob, url: URL.createObjectURL(thumbBlob), name, group: groupRef.current },
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
      // Rensa tidigare ström/intervall — relevant vid omstart efter
      // att iOS avslutat kameratracken mitt i en session.
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
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
      // iOS-återhämtning: OS kan avsluta kameratracken eller pausa videon
      // vid avbrott/minnespress — återställ istället för en död/svart vy.
      const track = stream.getVideoTracks()[0];
      const onEnded = () => { void startCameraRef.current?.(); };
      const onPause = () => { void video?.play().catch(() => undefined); };
      const onVis = () => {
        if (document.visibilityState === "visible") {
          void video?.play().catch(() => undefined);
        }
      };
      track?.addEventListener("ended", onEnded);
      video?.addEventListener("pause", onPause);
      document.addEventListener("visibilitychange", onVis);
      listenersRef.current = { track, onEnded, onPause, onVis };
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
    startCameraRef.current = startCamera;
    if (open) {
      setPages((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
      counterRef.current = 0;
      groupRef.current = 0;
      statusHoldUntilRef.current = 0;
      setConfirmDiscard(false);
      setStatus("searching");
      setFlash(false);
      setGroupCount(1);
      setElevNotice(null);
      setPhase("facit");
      setVideoReady(false);
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

  const nextStudent = () => {
    groupRef.current += 1;
    setGroupCount(groupRef.current);
    setElevNotice(groupRef.current);
    window.setTimeout(() => setElevNotice(null), 1600);
  };

  const startStudents = () => {
    setPhase("elever");
    groupRef.current = 1;
    setGroupCount(1);
    setElevNotice(1);
    window.setTimeout(() => setElevNotice(null), 1600);
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
    elevNotice !== null
      ? `Elev ${elevNotice} — fortsätt skanna`
      : status === "captured"
        ? phase === "facit"
          ? "Facit sparat"
          : `Sida ${pages.length} sparad`
        : status === "holding"
          ? "Dokument hittat — håll stilla"
          : phase === "facit"
            ? "Skanna facit/frågeblad — valfritt"
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
        disablePictureInPicture
        onCanPlay={() => setVideoReady(true)}
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
            status === "captured" || elevNotice !== null
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

        {/* Thumbnail-strip — vertikal avskiljare + E-märke vid elevgräns */}
        {pages.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {pages.map((p, i) => {
              const groupStart = i === 0 || p.group !== pages[i - 1].group;
              return (
                <Fragment key={p.url}>
                  {i > 0 && groupStart && (
                    <div className="w-px shrink-0 self-stretch bg-white/30" />
                  )}
                  <div className="relative shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={`Skannad sida ${i + 1}`}
                      className="h-16 w-12 rounded-lg border border-white/25 object-cover"
                    />
                    {groupStart && (
                      <span className="absolute left-0 top-0 rounded-br-md rounded-tl-lg bg-black/70 px-1 py-px text-[9px] font-semibold text-white/90">
                        {p.group === 0 ? "Facit" : `E${p.group}`}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removePage(i)}
                      aria-label={`Ta bort sida ${i + 1}`}
                      className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/80 text-white ring-1 ring-white/30"
                    >
                      <LineIcon name="x" className="h-3 w-3" />
                    </button>
                  </div>
                </Fragment>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <div className="w-14 text-sm font-medium text-white/80">
            <div>{phase === "facit" ? "Facit" : `Elev ${groupCount}`}</div>
            {pages.length > 0 && (
              <div className="text-xs text-white/50">{pages.length} sidor</div>
            )}
          </div>

          <div className="flex items-center gap-5">
            {phase === "facit" ? (
              /* Fasbyte: frågeblad/facit klart → börja skanna elever.
                 Sidor hittills är grupp 0 (e00) — hårt åtskilda i pipelinen. */
              <button
                type="button"
                onClick={startStudents}
                disabled={!!error}
                aria-label="Börja skanna elever"
                className="grid h-11 place-items-center rounded-full bg-white/15 px-4 ring-1 ring-white/25 backdrop-blur text-[13px] font-semibold transition-transform active:scale-95 disabled:opacity-40"
              >
                Elever →
              </button>
            ) : (
              /* Nästa elev — explicit elevgräns (eNN i filnamnet) som
                 pipelinen läser som hård segmentgräns vid gruppering. */
              <button
                type="button"
                onClick={nextStudent}
                disabled={!!error}
                aria-label="Nästa elev"
                title="Nästa elev"
                className="grid h-11 w-11 place-items-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur transition-transform active:scale-90 disabled:opacity-40"
              >
                <LineIcon name="users" className="h-5 w-5" />
              </button>
            )}

            {/* Manuell slutare — disabled tills videon faktiskt spelar
                (annars blir första trycket en tyst no-op). */}
            <button
              type="button"
              onClick={() => void captureFrame()}
              disabled={!!error || !videoReady}
              aria-label="Ta bild"
              className="grid h-[68px] w-[68px] place-items-center rounded-full border-4 border-white bg-white/20 transition-transform active:scale-90 disabled:opacity-40"
            >
              <span className="h-12 w-12 rounded-full bg-white" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleDone}
            className="w-14 rounded-xl bg-white px-0 py-2.5 text-center text-sm font-semibold text-black disabled:opacity-40"
          >
            Klar
          </button>
        </div>
      </div>
    </div>
  );
}
