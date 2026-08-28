"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useInView, useScroll, useMotionValueEvent } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { LOGO_MARK } from "@/lib/logo";
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

  if (!open) return null;

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
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
              onClick={() => {
                setSignupDone(false);
                setMode("login");
              }}
              className="text-[13px] font-medium text-accent hover:underline"
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
                className="w-full rounded-xl border border-ink-hairline/10 bg-paper-raised px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted outline-none transition-all focus:border-accent focus:ring-1 focus:ring-ink"
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
                className="w-full rounded-xl border border-ink-hairline/10 bg-paper-raised px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-muted outline-none transition-all focus:border-accent focus:ring-1 focus:ring-ink"
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
                  className="font-medium text-accent hover:underline"
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
                  className="font-medium text-accent hover:underline"
                >
                  Logga in
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </div>
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
      <div className="relative z-10 flex h-full flex-col rounded-2xl border border-ink-hairline/10 bg-paper-raised p-5 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-accent/10 p-1 text-accent">
            <LineIcon name="grid" className="h-5 w-5" />
          </div>
          <div className="h-2 w-24 rounded bg-ink/10" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-ink/5 p-2">
            <div className="text-[9px] text-ink-secondary">Prov</div>
            <div className="text-sm font-semibold text-ink">12</div>
          </div>
          <div className="rounded-xl bg-ink/5 p-2">
            <div className="text-[9px] text-ink-secondary">Tid sparad</div>
            <div className="text-sm font-semibold text-ink">4h</div>
          </div>
          <div className="rounded-xl bg-accent/10 p-2">
            <div className="text-[9px] text-accent">AI-rättat</div>
            <div className="text-sm font-semibold text-ink">89</div>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-2 w-full rounded bg-ink/5" />
          <div className="h-2 w-5/6 rounded bg-ink/5" />
          <div className="h-2 w-4/6 rounded bg-ink/5" />
        </div>
        <div className="mt-auto rounded-xl border border-dashed border-ink-hairline/10 bg-ink/[0.02] p-3 text-center">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[11px] font-medium text-paper">
            <LineIcon name="check" className="h-3 w-3" />
            Klart att publicera
          </div>
        </div>
      </div>
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
      <span className="mb-3 inline-flex items-center rounded-full border border-accent/25 bg-accent/5 px-3 py-1 text-[12px] font-medium text-accent">
        {badge}
      </span>
      <h2 className="text-[24px] md:text-[30px] font-semibold tracking-tight text-ink">{title}</h2>
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
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/15 bg-accent/10 text-accent">
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

function DemoCount({ to }: { to: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setValue((v) => {
        if (v >= to) {
          window.clearInterval(id);
          return to;
        }
        return v + 1;
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [to]);

  return <span>{value}</span>;
}

function DemoShowcase() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.6 });
  const [demoStep, setDemoStep] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const timers: number[] = [];
    let current = 0;
    const advance = () => {
      current += 1;
      if (current <= 3) {
        setDemoStep(current);
        timers.push(window.setTimeout(advance, 2600));
      }
    };
    timers.push(window.setTimeout(advance, 2600));
    return () => timers.forEach(window.clearTimeout);
  }, [isInView]);

  return (
    <section ref={ref} className="mt-20 border-t border-ink-hairline/5 pt-10">
      <SectionHeading
        badge="Produktdemo"
        title="Se hur WiseOS rättar ett prov från start till mål"
        subtitle="Scrolla ner för att starta demo-sekvensen — ingen knapptryckning krävs."
      />
      <div className="mx-auto aspect-[16/10] w-full max-w-4xl overflow-hidden rounded-3xl border border-ink-hairline/10 bg-paper-raised shadow-2xl">
        <AnimatePresence mode="wait">
          {demoStep === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full flex-col items-center justify-center gap-6 p-5 md:p-8 text-center"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <LineIcon name="upload" className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-ink">Ladda upp provbunten</h3>
                <p className="text-sm text-ink-secondary">PDF eller bilder fungerar lika bra.</p>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-3 rounded-xl border border-dashed border-ink-hairline/15 bg-ink/5 px-4 py-3"
              >
                <LineIcon name="file" className="h-5 w-5 text-accent" />
                <span className="text-sm text-ink">Provbunt.pdf</span>
              </motion.div>
            </motion.div>
          )}

          {demoStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full flex-col items-center justify-center gap-6 p-5 md:p-8 text-center"
            >
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
              <div>
                <h3 className="text-xl font-semibold text-ink">AI rättar på sekunder</h3>
                <p className="text-sm text-ink-secondary">Steg-för-steg-bedömning av varje lösning.</p>
              </div>
              <div className="w-full max-w-xs space-y-2">
                {["Löser uppgift 1", "Bedömer resonemang", "Kontrollerar enheter"].map((t, i) => (
                  <motion.div
                    key={t}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.2 }}
                    className="rounded-lg bg-ink/5 px-3 py-2 text-left text-sm text-ink"
                  >
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[10px] text-paper">✓</span>
                    {t}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {demoStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="h-full p-5 md:p-8"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-ink">Rättningsresultat</h3>
                <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs text-accent">12 prov</span>
              </div>
              <div className="space-y-3">
                {[
                  { name: "Erik Svensson", score: 18, max: 20 },
                  { name: "Maja Lindqvist", score: 14, max: 20 },
                  { name: "Oliver Berg", score: 20, max: 20 },
                  { name: "Saga Norén", score: 17, max: 20 },
                ].map((s, i) => (
                  <motion.div
                    key={s.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-center justify-between rounded-xl bg-ink/5 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/10 text-[10px] font-medium text-accent">
                        {s.name.charAt(0)}
                      </div>
                      <span className="text-sm text-ink">{s.name}</span>
                    </div>
                    <div className="text-sm font-semibold text-ink">
                      <DemoCount to={s.score} />/{s.max}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {demoStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.98 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="flex h-full flex-col items-center justify-center gap-6 p-5 md:p-8 text-center"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
                <LineIcon name="check" className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-ink">Klart att publicera</h3>
              <p className="max-w-sm text-sm text-ink-secondary">
                Granska, justera eventuella poäng och publicera resultaten till eleverna.
              </p>
              <div className="rounded-xl border border-dashed border-ink-hairline/10 bg-ink/5 p-4 text-left">
                <div className="mb-2 flex items-center gap-2 text-sm text-ink">
                  <LineIcon name="check" className="h-4 w-4 text-accent" />
                  12/12 prov granskade
                </div>
                <div className="flex items-center gap-2 text-sm text-ink">
                  <LineIcon name="check" className="h-4 w-4 text-accent" />
                  0 konflikter kvar
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
      className="relative left-1/2 mt-20 w-screen -translate-x-1/2 overflow-hidden bg-paper md:min-h-[90vh]"
    >
      <motion.img
        initial={{ opacity: 0, scale: 1.05 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        src="/front1.jpg"
        alt="Arbetsplats med papper och laptop"
        loading="lazy"
        className="h-[55vh] w-full object-cover md:absolute md:right-0 md:top-0 md:h-full md:w-[75%]"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%, black 88%, transparent 100%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-paper via-paper/90 via-[40%] to-transparent md:block" />
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
              className="rounded-full bg-ink px-7 py-3.5 text-[14px] font-semibold text-paper shadow-soft transition-all hover:shadow-soft hover:scale-[1.02] active:scale-[0.98]"
            >
              Kom igång gratis
            </button>
            <button
              onClick={onLogin}
              className="rounded-full border border-ink/15 px-7 py-3.5 text-[14px] font-medium text-ink transition-all hover:bg-ink/5"
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
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);

  useMotionValueEvent(scrollY, "change", (latest) => {
    const prev = lastY.current;
    lastY.current = latest;
    setScrolled(latest > 32);
    if (latest < 50) {
      setHidden(false);
    } else if (latest > prev + 5) {
      setHidden(true);
    } else if (latest < prev - 5) {
      setHidden(false);
    }
  });

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (<div className="min-h-screen overflow-y-auto overflow-x-hidden bg-paper text-ink">
      {/* Top bar */}
      <motion.header
        initial={{ y: 0 }}
        animate={{ y: hidden ? "-100%" : 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 inset-x-0 z-40 h-16 border-b border-equi-800/50 backdrop-blur-lg transition-colors duration-300 ${scrolled ? "bg-equi-950/95" : "bg-equi-950/70"}`}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <img src={LOGO_MARK} alt="WiseOS" className="h-9 w-auto object-contain mix-blend-difference" />
            <span className="text-[15px] font-medium tracking-tight text-paper">WiseOS</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openAuth("login")}
              className="rounded-full border border-ink-hairline/10 px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-white/10"
            >
              Logga in
            </button>
            <button
              onClick={() => openAuth("signup")}
              className="rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-paper transition-all hover:shadow-soft active:scale-[0.98]"
            >
              Kom igång gratis
            </button>
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-6xl px-6 pt-32 pb-24">
        {/* Hero */}
        <section className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-accent/25 bg-accent/5 px-3 py-1.5 text-[12px] font-medium text-accent"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-ink" />
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
                className="rounded-full bg-ink px-7 py-3 text-[14px] font-semibold text-paper shadow-soft transition-all hover:shadow-soft hover:scale-[1.02] active:scale-[0.98]"
              >
                Kom igång gratis
              </button>
              <button
                onClick={() => openAuth("login")}
                className="rounded-full border border-ink-hairline/10 px-7 py-3 text-[14px] font-medium text-ink transition-all hover:bg-ink/5"
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
                  className="rounded-2xl border border-accent/15 bg-ink/5 p-4"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <LineIcon name={stat.icon} className="h-5 w-5" />
                  </div>
                  <div className="text-[20px] font-bold text-ink">{stat.value}</div>
                  <div className="mt-1 text-[11.5px] leading-snug text-ink-secondary">{stat.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          <DashboardStack />
        </section>

        {/* How it works */}
        <ProcessSteps />

        {/* Interactive product demo */}
        <DemoShowcase />

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
                className="group flex h-full flex-col rounded-2xl border border-ink-hairline/10 bg-paper-raised p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-soft"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
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

        <Finale onStart={() => openAuth("signup")} onLogin={() => openAuth("login")} />
      </main>

      <footer className="border-t border-ink-hairline/5 py-8 text-center text-[12px] text-ink-secondary">
        {new Date().getFullYear()} Wisecast AB
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </div>
  );
}
