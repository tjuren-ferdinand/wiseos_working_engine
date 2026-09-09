"use client";

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import LineIcon, { type IconName } from "@/components/LineIcon";
import LoginHeroScan from "@/components/LoginHeroScan";
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
    if (oauthError) setError(oauthError.message);
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
      <div className="absolute inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-ink-hairline/10 bg-paper-elevated p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[20px] font-medium tracking-[-0.01em] text-ink">
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
              onClick={() => { setSignupDone(false); setMode("login"); }}
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
                className="w-full rounded-xl border border-ink-hairline/10 bg-paper-raised px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted outline-none transition-all focus:border-ink focus:ring-1 focus:ring-ink"
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
                className="w-full rounded-xl border border-ink-hairline/10 bg-paper-raised px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted outline-none transition-all focus:border-ink focus:ring-1 focus:ring-ink"
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
              className="w-full rounded-xl bg-ink px-4 py-2.5 text-[14px] font-semibold text-paper transition-all hover:shadow-soft disabled:opacity-50"
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
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink-hairline/10 bg-paper-raised px-4 py-2.5 text-[14px] font-medium text-ink transition-all hover:bg-ink/5"
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
                  onClick={() => { setError(null); setMode("signup"); }}
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
                  onClick={() => { setError(null); setMode("login"); }}
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
      className="mb-14 text-center"
    >
      <span className="mb-3 inline-flex items-center rounded-xl border border-ink-hairline bg-ink/5 px-3 py-1 text-[12px] font-medium text-ink">
        {badge}
      </span>
      <h2 className="text-[26px] md:text-[32px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
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
    <section className="border-t border-ink-hairline/5 py-24">
      <SectionHeading
        badge="Så fungerar det"
        title="Från papper till publicering på fyra steg"
      />
      <div className="mx-auto max-w-4xl">
        <div className="grid gap-12 md:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative z-10 text-center"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-hairline bg-ink/5 text-ink">
                <LineIcon name={s.icon} className="h-6 w-6" />
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
  const stats = SOCIAL_STATS;
  const quotes = TESTIMONIALS;

  return (
    <section className="border-t border-ink-hairline/5 py-24">
      <SectionHeading badge="Förtroende" title="Används av lärare varje dag" />
      <div className="grid gap-5 md:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-ink-hairline/10 bg-paper-raised p-6 text-center"
          >
            <div className="text-[28px] font-bold text-ink">{s.value}</div>
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

  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden bg-paper text-ink">
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
              className="rounded-xl border border-ink-hairline/10 px-4 py-2 text-[13px] font-medium text-ink transition-all hover:bg-ink/5"
            >
              Logga in
            </button>
            <button
              onClick={() => openAuth("signup")}
              className="rounded-xl bg-ink px-4 py-2 text-[13px] font-semibold text-paper transition-all hover:shadow-soft active:scale-[0.98]"
            >
              Kom igång gratis
            </button>
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero */}
        <section className="relative grid min-h-[calc(100svh-4rem)] items-center gap-10 pb-16 pt-32 sm:gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 lg:pb-24 lg:pt-36">
          <div className="min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mb-5 text-[10px] font-medium uppercase tracking-[0.16em] text-ink-secondary"
            >
              AI-rättning. Lärarens omdöme.
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-lg text-[42px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink md:text-[56px] lg:text-[64px]"
            >
              Rätta prov på minuter, inte kvällar.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-md text-[16px] leading-relaxed text-ink-secondary md:text-[17px]"
            >
              WiseOS läser, bedömer och förklarar elevernas lösningar så att du kan fokusera på undervisningen i stället för pappershögar.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8"
            >
              <button
                onClick={() => openAuth("signup")}
                className="rounded-xl bg-ink px-8 py-3.5 text-[15px] font-semibold text-paper shadow-soft transition-all hover:shadow-soft hover:scale-[1.02] active:scale-[0.98]"
              >
                Kom igång gratis
              </button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-12 grid grid-cols-3 gap-5 border-t border-ink-hairline/10 pt-6"
            >
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-0">
                  <div className="text-[18px] font-medium tracking-tight text-ink">{stat.value}</div>
                  <div className="mt-1.5 max-w-[100px] text-[10px] leading-relaxed text-ink-secondary">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="relative flex min-w-0 items-center lg:-mr-6">
            <LoginHeroScan />
          </div>
        </section>

        {/* How it works */}
        <ProcessSteps />

        {/* Features */}
        <section className="border-t border-ink-hairline/5 py-24">
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

        {/* Simple closing CTA */}
        <section className="border-t border-ink-hairline/5 py-24 text-center">
          <h2 className="text-[24px] md:text-[30px] font-semibold tracking-[-0.02em] text-ink">
            Mindre rättning. Mer undervisning.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] text-ink-secondary">
            Börja spara timmar varje vecka — skapa ett konto och testa WiseOS gratis.
          </p>
          <button
            onClick={() => openAuth("signup")}
            className="mt-8 rounded-xl bg-ink px-8 py-3.5 text-[15px] font-semibold text-paper shadow-soft transition-all hover:shadow-soft hover:scale-[1.02] active:scale-[0.98]"
          >
            Kom igång gratis
          </button>
        </section>
      </main>

      <footer className="border-t border-ink-hairline/5 py-8 text-center text-[12px] text-ink-secondary">
        {new Date().getFullYear()} Wisecast AB
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </div>
  );
}
