"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useInView, useScroll, useMotionValueEvent } from "framer-motion";
import Image from "next/image";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import LineIcon, { type IconName } from "@/components/LineIcon";
import { TESTIMONIALS } from "@/lib/data/testimonials";
import { SOCIAL_STATS } from "@/lib/data/stats";

type AuthMode = "login" | "signup";

const FEATURES: { title: string; desc: string; icon: IconName }[] = [
  {
    title: "AI-rättning på sekunder",
    desc: "Skanna in elevernas prov och få steg-för-steg-bedömd rättning direkt.",
    icon: "sparkles",
  },
  {
    title: "Full insyn & kontroll",
    desc: "Du granskar och justerar varje poäng innan resultat publiceras till eleverna.",
    icon: "check",
  },
  {
    title: "Byggt för svenska STEM-lärare",
    desc: "Matematik, fysik och kemi — med rätt terminologi och bedömningsstöd.",
    icon: "graduation-cap",
  },
  {
    title: "Klass- & kurshantering",
    desc: "Organisera klasser, elever och prov i en översiktlig struktur.",
    icon: "users",
  },
  {
    title: "Tydliga rättningsrapporter",
    desc: "Få automatiska rapporter med statistik och bedömningsunderlag.",
    icon: "chart",
  },
  {
    title: "Säker & GDPR-säker",
    desc: "Din data hanteras säkert och rensas automatiskt efter rättning.",
    icon: "settings",
  },
];

const stats = [
  { value: "4+", label: "timmar sparade i veckan", icon: "chart" as const },
  { value: "Sekunder", label: "per AI-rättat prov", icon: "sparkles" as const },
  { value: "100 %", label: "kontroll över betyg", icon: "check" as const },
] as const;


function AuthModal({
  open,
  onClose,
  initialMode,
}: {
  open: boolean;
  onClose: () => void;
  initialMode: AuthMode;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupDone, setSignupDone] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setError(null);
    setSignupDone(false);
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]',
    ) ?? []);
    (dialog?.querySelector<HTMLElement>("input") ?? focusable()[0] ?? dialog)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        dialog?.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [open, initialMode]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const handleGoogleLogin = async () => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (signUpData.session) {
      router.push("/");
      router.refresh();
      return;
    }
    setSignupDone(true);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="auth-title" tabIndex={-1} className="relative max-h-[90svh] w-full max-w-[400px] overflow-y-auto rounded-2xl border border-ink-hairline bg-paper-elevated p-6 shadow-float">
        <div className="mb-6 flex items-center justify-between">
          <h2 id="auth-title" className="text-[20px] font-medium tracking-[-0.01em] text-ink">
            {mode === "login" ? "Välkommen tillbaka" : "Kom igång med WiseOS"}
          </h2>
          <button onClick={onClose} aria-label="Stäng" type="button" className="text-ink-secondary hover:text-ink">
            <LineIcon name="x" className="h-5 w-5" />
          </button>
        </div>

        {signupDone ? (
          <div className="space-y-4 text-center">
            <p className="text-[13.5px] leading-relaxed text-ink">
              Konto skapat! Kolla din e-post ({email}) för att bekräfta adressen innan du loggar in.
            </p>
            <button
              type="button"
              onClick={() => {
                setSignupDone(false);
                setMode("login");
              }}
              className="text-[13px] font-medium text-ink hover:underline"
            >
              Tillbaka till inloggning
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-medium text-ink-secondary">
                E-post
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="namn@skola.se"
                className="input"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-medium text-ink-secondary">
                Lösenord
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-state-danger/10 px-3 py-2 text-[12.5px] text-state-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading
                ? "Ett ögonblick…"
                : mode === "login"
                ? "Logga in"
                : "Skapa konto"}
            </button>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-ink-hairline/20" />
              <span className="text-[12px] text-ink-muted">eller</span>
              <div className="h-px flex-1 bg-ink-hairline/20" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="btn-secondary w-full gap-2.5"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Fortsätt med Google
            </button>
          </form>
        )}

        {!signupDone && (
          <p className="mt-5 text-center text-[13px] text-ink-secondary">
            {mode === "login" ? (
              <>
                Inget konto?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode("signup");
                  }}
                  className="font-medium text-ink hover:underline"
                >
                  Skapa ett här
                </button>
              </>
            ) : (
              <>
                Har du redan ett konto?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode("login");
                  }}
                  className="font-medium text-ink hover:underline"
                >
                  Logga in
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}

function DashboardStack() {
  return (
    <div className="pointer-events-none relative hidden h-80 w-full max-w-md lg:block" style={{ perspective: "1000px" }}>
      <div
        className="absolute inset-0 rounded-2xl border border-ink-hairline/5 bg-paper-raised shadow-2xl"
        style={{ transform: "rotate(-8deg) translate(-1.5rem, 1.25rem)" }}
      />
      <div
        className="absolute inset-0 rounded-2xl border border-ink-hairline/5 bg-paper-raised shadow-2xl"
        style={{ transform: "rotate(-4deg) translate(-0.5rem, 0.5rem)" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex h-full flex-col rounded-2xl border border-ink-hairline/10 bg-paper-raised p-5 shadow-2xl"
      >
        <div className="mb-3 flex items-center">
          <LineIcon name="grid" className="h-4 w-4 text-ink-hairline/60" />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-ink/5 p-3">
            <LineIcon name="file" className="mb-1.5 h-4 w-4 text-ink-hairline/70" />
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-secondary">Prov</div>
            <div className="text-[18px] font-semibold text-ink">12</div>
          </div>
          <div className="rounded-xl bg-ink/5 p-3">
            <LineIcon name="chart" className="mb-1.5 h-4 w-4 text-ink-hairline/70" />
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-secondary">Tid sparad</div>
            <div className="text-[18px] font-semibold text-ink">4h</div>
          </div>
          <div className="rounded-xl bg-ink/5 p-3">
            <LineIcon name="sparkles" className="mb-1.5 h-4 w-4 text-ink-hairline/70" />
            <div className="text-[10px] font-medium uppercase tracking-wider text-ink-secondary">AI-rättat</div>
            <div className="text-[18px] font-semibold text-ink">89</div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="h-2 w-full rounded bg-ink/5" />
          <div className="h-2 w-5/6 rounded bg-ink/5" />
          <div className="h-2 w-4/6 rounded bg-ink/5" />
        </div>

        <div className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-ink to-black p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          >
            <LineIcon name="check" className="h-4 w-4 text-paper" />
          </motion.div>
          <span className="text-[12px] font-semibold text-paper">Klart att publicera</span>
        </div>
      </motion.div>
    </div>
  );
}

function SectionHeading({
  badge,
  title,
  subtitle,
}: {
  badge: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mb-10 text-center"
    >
      <span className="mb-3 inline-flex items-center rounded-xl border border-ink-hairline bg-ink/5 px-3 py-1 text-[12px] font-medium text-ink">
        {badge}
      </span>
      <h2 className="text-[28px] font-medium leading-[1.15] tracking-[-0.02em] text-ink">{title}</h2>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-ink-secondary">{subtitle}</p>
      )}
    </motion.div>
  );
}

function ProcessSteps() {
  const steps = [
    { n: "1", icon: "upload" as IconName, title: "Ladda upp", desc: "Dra in provbunten som PDF eller bilder." },
    { n: "2", icon: "sparkles" as IconName, title: "AI rättar", desc: "WiseOS bedömer varje lösning på sekunder." },
    { n: "3", icon: "pen" as IconName, title: "Granska", desc: "Du justerar poäng och feedback innan publicering." },
    { n: "4", icon: "send" as IconName, title: "Publicera", desc: "Resultaten delas direkt med eleverna." },
  ];

  return (
    <section className="mt-20 border-t border-ink-hairline/5 pt-10">
      <SectionHeading
        badge="Så fungerar det"
        title="Från papper till publicering på fyra steg"
      />
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-6 md:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 text-center"
            >
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-ink-hairline bg-ink/5 text-ink">
                <LineIcon name={s.icon} className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-[16px] font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}


function SocialProof() {
  // TODO: update with real numbers once they are available
  const stats = SOCIAL_STATS;

  // TODO: replace with real quotes before launch
  const quotes = TESTIMONIALS;

  return (
    <section className="mt-20 border-t border-ink-hairline/5 pt-10">
      <SectionHeading badge="Förtroende" title="Används av lärare varje dag" />
      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-ink-hairline/10 bg-paper-raised p-6 text-center"
          >
            <div className="text-[28px] font-medium tabular-nums text-ink">{s.value}</div>
            <div className="mt-1 text-[13px] text-ink-secondary">{s.label}</div>
          </motion.div>
        ))}
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {quotes.map((q, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-ink-hairline/10 bg-paper-raised p-6"
          >
            <p className="text-[15px] italic leading-relaxed text-ink">“{q.quote}”</p>
            <div className="mt-4">
              <div className="text-[14px] font-medium text-ink">{q.name}</div>
              <div className="text-[12px] text-ink-secondary">{q.role}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Finale({
  onStart,
  onLogin,
}: {
  onStart: () => void;
  onLogin: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      ref={ref}
      className="relative left-1/2 mt-0 w-screen -translate-x-1/2 overflow-hidden bg-paper md:min-h-[90vh]"
    >
      <div
        className="h-[55vh] w-full md:absolute md:right-[-4%] md:top-[6%] md:h-[100%] md:w-[75%]"
        style={{
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 15%)",
          maskImage: "linear-gradient(to right, transparent 0%, black 15%)",
        }}
      >
        <motion.img
          initial={{ opacity: 0, scale: 1.05 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          src="/hero/copilot-hero4.png"
          alt="WiseOS rättningsflöde"
          loading="lazy"
          className="h-full w-full object-cover"
          style={{
            objectPosition: "50% 50%",
            maskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)",
          }}
        />
      </div>
      <div className="relative z-10 flex flex-col justify-center bg-paper px-6 py-16 md:absolute md:inset-y-0 md:left-0 md:w-[45%] md:bg-transparent md:px-12 lg:px-20">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-xl"
        >
          <p className="mb-3 text-[12px] font-medium uppercase tracking-wider text-ink-secondary">I verkligheten</p>
          <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink md:text-[44px] lg:text-[56px]">
            Ett rent, lugnt arbetsflöde.
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-secondary md:text-[17px]">
            Från skrivbordet till digital rättning — utan pappershögar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={onStart}
              className="btn-primary px-7 py-3.5 shadow-soft"
            >
              Kom igång gratis
            </button>
            <button
              onClick={onLogin}
              className="btn-secondary px-7 py-3.5"
            >
              Logga in
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function LoginPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 32);
  });

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (<div className="min-h-screen overflow-y-auto overflow-x-hidden bg-paper text-ink">
      {/* Top bar */}
      <motion.header
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 inset-x-0 z-50 h-16 border-b border-ink-hairline bg-paper/80 backdrop-blur-lg transition-shadow duration-300 ${scrolled ? "shadow-soft" : "shadow-none"}`}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <Link href="/" className="group flex h-11 items-center gap-2">
            <Logo className="h-7 w-7 object-contain" alt="" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap text-[15px] font-semibold leading-none tracking-tight text-ink opacity-0 transition-all duration-300 group-hover:max-w-[5.5rem] group-hover:opacity-100">
              WiseOS
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openAuth("login")}
              className="btn-secondary px-4 py-2 text-[13px]"
            >
              Logga in
            </button>
            <button
              onClick={() => openAuth("signup")}
              className="btn-primary px-4 py-2 text-[13px]"
            >
              Kom igång gratis
            </button>
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-6xl px-6 pt-0 pb-0">
        {/* Closing image */}
        <Finale onStart={() => openAuth("signup")} onLogin={() => openAuth("login")} />

        {/* How it works */}
        <ProcessSteps />

        {/* Hero */}
        <section className="mt-20 grid items-center gap-16 lg:grid-cols-2">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mb-4 inline-flex w-fit items-center gap-2 rounded-xl border border-ink-hairline bg-ink/5 px-3 py-1.5 text-[12px] font-medium text-ink"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-xl bg-ink opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-xl bg-ink" />
              </span>
              AI-driven rättning för svenska lärare
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-lg text-[42px] font-semibold leading-[1.1] tracking-[-0.02em] text-ink"
              style={{
                background: "linear-gradient(135deg, rgb(var(--foreground)) 0%, rgb(var(--muted)) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Rätta prov på minuter, inte kvällar.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-secondary"
            >
              WiseOS läser, bedömer och förklarar elevernas lösningar så att du kan fokusera på undervisningen i stället för pappershögar.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <button
                onClick={() => openAuth("signup")}
                className="btn-primary px-7 py-3 shadow-soft"
              >
                Kom igång gratis
              </button>
              <button
                onClick={() => openAuth("login")}
                className="btn-secondary px-7 py-3"
              >
                Logga in
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-10 grid grid-cols-3 gap-4"
            >
              {stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-ink-hairline/10 bg-paper-raised p-5"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-ink/5 text-ink-hairline">
                    <LineIcon name={stat.icon} className="h-5 w-5" />
                  </div>
                  <div className="text-[20px] font-semibold text-ink">{stat.value}</div>
                  <div className="mt-1 text-[11.5px] leading-snug text-ink-secondary">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="relative flex min-w-0 items-center">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
              <Image
                src="/hero/copilot-hero3.png"
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-contain"
              />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mt-20 border-t border-ink-hairline/5 pt-10">
          <SectionHeading
            badge="Funktioner"
            title="Allt du behöver för snabbare rättning"
            subtitle="Från uppladdning till publicering — WiseOS håller koll på detaljerna så att du slipper."
          />
          <div className="grid gap-5 auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
                className="group flex h-full flex-col rounded-2xl border border-ink-hairline/10 bg-paper-raised p-6 transition-all duration-300 hover:-translate-y-1 hover:border-ink-hairline/30 hover:shadow-soft"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-ink/5 text-ink-hairline transition-colors group-hover:bg-ink/10 group-hover:text-ink">
                  <LineIcon name={f.icon} className="h-6 w-6" />
                </div>
                <h3 className="text-[17px] font-semibold text-ink">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Social proof */}
        <SocialProof />
      </main>

      <footer className="mt-20 border-t border-ink-hairline/5 py-8 text-center text-[12px] text-ink-secondary">
        {new Date().getFullYear()} Wisecast AB
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </div>
  );
}
