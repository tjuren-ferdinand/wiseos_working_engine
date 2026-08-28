"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { LOGO_MARK } from "@/lib/logo";
import LineIcon, { type IconName } from "@/components/LineIcon";
import { TESTIMONIALS } from "@/lib/data/testimonials";
import { SOCIAL_STATS } from "@/lib/data/stats";

type AuthMode = "login" | "signup";

const ACCENT = "#0f766e";
const ACCENT_LIGHT = "#2dd4bf";

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
      <div className="relative w-full max-w-[400px] overflow-hidden rounded-2xl border border-[#E2E5E9]/10 bg-[#1c1d20] p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-[20px] font-medium tracking-[-0.01em] text-[#E2E5E9]">
            {mode === "login" ? "Välkommen tillbaka" : "Kom igång med WiseOS"}
          </h2>
          <button onClick={onClose} aria-label="Stäng" type="button" className="text-[#8a8f96] hover:text-[#E2E5E9]">
            <LineIcon name="x" className="h-5 w-5" />
          </button>
        </div>

        {signupDone ? (
          <div className="space-y-4 text-center">
            <p className="text-[13.5px] leading-relaxed text-[#E2E5E9]">
              Konto skapat! Kolla din e-post ({email}) för att bekräfta adressen innan du loggar in.
            </p>
            <button
              type="button"
              onClick={() => {
                setSignupDone(false);
                setMode("login");
              }}
              className="text-[13px] font-medium text-[#2dd4bf] hover:underline"
            >
              Tillbaka till inloggning
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[12.5px] font-medium text-[#8a8f96]">
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
                className="w-full rounded-xl border border-[#E2E5E9]/10 bg-[#0f1114] px-3.5 py-2.5 text-[14px] text-[#E2E5E9] placeholder:text-[#8a8f96] outline-none transition-all focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-[12.5px] font-medium text-[#8a8f96]">
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
                className="w-full rounded-xl border border-[#E2E5E9]/10 bg-[#0f1114] px-3.5 py-2.5 text-[14px] text-[#E2E5E9] placeholder:text-[#8a8f96] outline-none transition-all focus:border-[#0f766e] focus:ring-1 focus:ring-[#0f766e]"
              />
            </div>

            {error && (
              <p className="rounded-xl bg-[#ef4444]/10 px-3 py-2 text-[12.5px] text-[#ef4444]">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#0f766e] px-4 py-2.5 text-[14px] font-semibold text-white transition-all hover:shadow-[0_0_24px_-4px_rgba(15,118,110,0.45)] disabled:opacity-50"
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
          <p className="mt-5 text-center text-[13px] text-[#8a8f96]">
            {mode === "login" ? (
              <>
                Inget konto?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode("signup");
                  }}
                  className="font-medium text-[#2dd4bf] hover:underline"
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
                  className="font-medium text-[#2dd4bf] hover:underline"
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
        className="absolute inset-0 rounded-2xl border border-[#E2E5E9]/5 bg-[#0f1114] shadow-2xl"
        style={{ transform: "rotate(-8deg) translate(-1.5rem, 1.25rem)" }}
      />
      <div
        className="absolute inset-0 rounded-2xl border border-[#E2E5E9]/5 bg-[#0f1114] shadow-2xl"
        style={{ transform: "rotate(-4deg) translate(-0.5rem, 0.5rem)" }}
      />
      <div className="relative z-10 flex h-full flex-col rounded-2xl border border-[#E2E5E9]/10 bg-[#14151a] p-5 shadow-2xl">
        <div className="mb-4 flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-[#0f766e]/10 p-1 text-[#2dd4bf]">
            <LineIcon name="grid" className="h-5 w-5" />
          </div>
          <div className="h-2 w-24 rounded bg-[#E2E5E9]/10" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#E2E5E9]/5 p-2">
            <div className="text-[9px] text-[#8a8f96]">Prov</div>
            <div className="text-sm font-semibold text-[#E2E5E9]">12</div>
          </div>
          <div className="rounded-xl bg-[#E2E5E9]/5 p-2">
            <div className="text-[9px] text-[#8a8f96]">Tid sparad</div>
            <div className="text-sm font-semibold text-[#E2E5E9]">4h</div>
          </div>
          <div className="rounded-xl bg-[#0f766e]/10 p-2">
            <div className="text-[9px] text-[#2dd4bf]">AI-rättat</div>
            <div className="text-sm font-semibold text-[#E2E5E9]">89</div>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-2 w-full rounded bg-[#E2E5E9]/5" />
          <div className="h-2 w-5/6 rounded bg-[#E2E5E9]/5" />
          <div className="h-2 w-4/6 rounded bg-[#E2E5E9]/5" />
        </div>
        <div className="mt-auto rounded-xl border border-dashed border-[#E2E5E9]/10 bg-[#E2E5E9]/[0.02] p-3 text-center">
          <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-[#0f766e] px-3 py-1 text-[11px] font-medium text-white">
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
      <span className="mb-3 inline-flex items-center rounded-full border border-[#0f766e]/25 bg-[#0f766e]/5 px-3 py-1 text-[12px] font-medium text-[#2dd4bf]">
        {badge}
      </span>
      <h2 className="text-[24px] md:text-[30px] font-semibold tracking-tight text-[#E2E5E9]">{title}</h2>
      {subtitle && (
        <p className="mx-auto mt-3 max-w-xl text-[15px] text-[#8a8f96]">{subtitle}</p>
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
    <section className="mt-20 border-t border-[#E2E5E9]/5 pt-10">
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
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#0f766e]/15 bg-[#0f766e]/10 text-[#2dd4bf]">
                <LineIcon name={s.icon} className="h-7 w-7" />
              </div>
              <h3 className="mt-5 text-[16px] font-semibold text-[#E2E5E9]">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#8a8f96]">{s.desc}</p>
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
    <section ref={ref} className="mt-20 border-t border-[#E2E5E9]/5 pt-10">
      <SectionHeading
        badge="Produktdemo"
        title="Se hur WiseOS rättar ett prov från start till mål"
        subtitle="Scrolla ner för att starta demo-sekvensen — ingen knapptryckning krävs."
      />
      <div className="mx-auto aspect-[16/10] w-full max-w-4xl overflow-hidden rounded-3xl border border-[#E2E5E9]/10 bg-[#0f1114] shadow-2xl">
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0f766e]/10 text-[#2dd4bf]">
                <LineIcon name="upload" className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-[#E2E5E9]">Ladda upp provbunten</h3>
                <p className="text-sm text-[#8a8f96]">PDF eller bilder fungerar lika bra.</p>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex items-center gap-3 rounded-xl border border-dashed border-[#E2E5E9]/15 bg-[#E2E5E9]/5 px-4 py-3"
              >
                <LineIcon name="file" className="h-5 w-5 text-[#2dd4bf]" />
                <span className="text-sm text-[#E2E5E9]">Provbunt.pdf</span>
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
              <div className="h-12 w-12 animate-spin rounded-full border-2 border-[#0f766e]/20 border-t-[#2dd4bf]" />
              <div>
                <h3 className="text-xl font-semibold text-[#E2E5E9]">AI rättar på sekunder</h3>
                <p className="text-sm text-[#8a8f96]">Steg-för-steg-bedömning av varje lösning.</p>
              </div>
              <div className="w-full max-w-xs space-y-2">
                {["Löser uppgift 1", "Bedömer resonemang", "Kontrollerar enheter"].map((t, i) => (
                  <motion.div
                    key={t}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.2 }}
                    className="rounded-lg bg-[#E2E5E9]/5 px-3 py-2 text-left text-sm text-[#E2E5E9]"
                  >
                    <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#0f766e] text-[10px] text-white">✓</span>
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
                <h3 className="text-lg font-semibold text-[#E2E5E9]">Rättningsresultat</h3>
                <span className="rounded-full bg-[#0f766e]/10 px-2.5 py-1 text-xs text-[#2dd4bf]">12 prov</span>
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
                    className="flex items-center justify-between rounded-xl bg-[#E2E5E9]/5 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0f766e]/10 text-[10px] font-medium text-[#2dd4bf]">
                        {s.name.charAt(0)}
                      </div>
                      <span className="text-sm text-[#E2E5E9]">{s.name}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#E2E5E9]">
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
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#0f766e]/10 text-[#2dd4bf]">
                <LineIcon name="check" className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-semibold text-[#E2E5E9]">Klart att publicera</h3>
              <p className="max-w-sm text-sm text-[#8a8f96]">
                Granska, justera eventuella poäng och publicera resultaten till eleverna.
              </p>
              <div className="rounded-xl border border-dashed border-[#E2E5E9]/10 bg-[#E2E5E9]/5 p-4 text-left">
                <div className="mb-2 flex items-center gap-2 text-sm text-[#E2E5E9]">
                  <LineIcon name="check" className="h-4 w-4 text-[#2dd4bf]" />
                  12/12 prov granskade
                </div>
                <div className="flex items-center gap-2 text-sm text-[#E2E5E9]">
                  <LineIcon name="check" className="h-4 w-4 text-[#2dd4bf]" />
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
    <section className="mt-20 border-t border-[#E2E5E9]/5 pt-10">
      <SectionHeading badge="Förtroende" title="Används av lärare varje dag" />
      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl border border-[#E2E5E9]/10 bg-[#0f1114] p-6 text-center"
          >
            <div className="text-[28px] font-bold text-[#E2E5E9]">{s.value}</div>
            <div className="mt-1 text-[13px] text-[#8a8f96]">{s.label}</div>
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
            className="rounded-2xl border border-[#E2E5E9]/10 bg-[#0f1114] p-6"
          >
            <p className="text-[15px] italic leading-relaxed text-[#E2E5E9]">“{q.quote}”</p>
            <div className="mt-4">
              <div className="text-[14px] font-medium text-[#E2E5E9]">{q.name}</div>
              <div className="text-[12px] text-[#8a8f96]">{q.role}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function FinalCTA({ onStart }: { onStart: () => void }) {
  return (
    <section className="relative mt-20 overflow-hidden rounded-3xl border border-[#0f766e]/15 bg-gradient-to-b from-[#0f766e]/10 to-[#0f766e]/5 px-6 py-16 text-center">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(circle at 50% 0%, rgba(45,212,191,0.12), transparent 60%)",
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative"
      >
        <h2 className="text-[26px] md:text-[32px] font-semibold tracking-tight text-[#E2E5E9]">Kom igång gratis idag</h2>
        <p className="mx-auto mt-3 max-w-lg text-[15px] text-[#8a8f96]">
          Skapa ett konto, ladda upp ditt första prov och låt WiseOS visa hur mycket tid du kan spara.
        </p>
        <button
          onClick={onStart}
          className="mt-8 inline-flex rounded-full bg-[#0f766e] px-8 py-3.5 text-[15px] font-semibold text-white shadow-[0_0_32px_-4px_rgba(15,118,110,0.45)] transition-all hover:shadow-[0_0_40px_-2px_rgba(15,118,110,0.6)] hover:scale-[1.02] active:scale-[0.98]"
        >
          Kom igång gratis
        </button>
      </motion.div>
    </section>
  );
}

export default function LoginPage() {
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  return (<div className="fixed inset-0 z-10 overflow-y-auto overflow-x-hidden bg-[#14151a]">
      {/* Top bar */}
      <header className="fixed top-0 inset-x-0 z-40 h-16 border-b border-[#E2E5E9]/5 bg-[#14151a]/80 backdrop-blur-lg">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <img src={LOGO_MARK} alt="WiseOS" className="h-8 w-auto object-contain" />
            <span className="text-[15px] font-medium tracking-tight text-[#E2E5E9]">WiseOS</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openAuth("login")}
              className="rounded-full border border-[#E2E5E9]/10 px-4 py-2 text-[13px] font-medium text-[#E2E5E9] transition-all hover:bg-[#E2E5E9]/5"
            >
              Logga in
            </button>
            <button
              onClick={() => openAuth("signup")}
              className="rounded-full bg-[#0f766e] px-4 py-2 text-[13px] font-semibold text-white transition-all hover:shadow-[0_0_24px_-4px_rgba(15,118,110,0.45)] active:scale-[0.98]"
            >
              Kom igång gratis
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-32 pb-24">
        {/* Hero */}
        <section className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-[#0f766e]/25 bg-[#0f766e]/5 px-3 py-1.5 text-[12px] font-medium text-[#2dd4bf]"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#0f766e] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#0f766e]" />
              </span>
              AI-driven rättning för svenska lärare
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-lg text-[42px] font-semibold leading-[1.1] tracking-[-0.02em] text-[#E2E5E9]"
              style={{
                background: "linear-gradient(135deg, #E2E5E9 0%, #8a8f96 100%)",
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
              className="mt-5 max-w-md text-[15px] leading-relaxed text-[#8a8f96]"
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
                className="rounded-full bg-[#0f766e] px-7 py-3 text-[14px] font-semibold text-white shadow-[0_0_24px_-4px_rgba(15,118,110,0.45)] transition-all hover:shadow-[0_0_32px_-2px_rgba(15,118,110,0.6)] hover:scale-[1.02] active:scale-[0.98]"
              >
                Kom igång gratis
              </button>
              <button
                onClick={() => openAuth("login")}
                className="rounded-full border border-[#E2E5E9]/10 px-7 py-3 text-[14px] font-medium text-[#E2E5E9] transition-all hover:bg-[#E2E5E9]/5"
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
                  className="rounded-2xl border border-[#0f766e]/15 bg-[#E2E5E9]/5 p-4"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f766e]/10 text-[#2dd4bf]">
                    <LineIcon name={stat.icon} className="h-5 w-5" />
                  </div>
                  <div className="text-[20px] font-bold text-[#E2E5E9]">{stat.value}</div>
                  <div className="mt-1 text-[11.5px] leading-snug text-[#8a8f96]">{stat.label}</div>
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
        <section className="mt-20 border-t border-[#E2E5E9]/5 pt-10">
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
                className="group flex h-full flex-col rounded-2xl border border-[#E2E5E9]/10 bg-[#0f1114] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[#0f766e]/30 hover:shadow-[0_0_32px_-8px_rgba(15,118,110,0.2)]"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0f766e]/10 text-[#2dd4bf] transition-colors group-hover:bg-[#0f766e]/20">
                  <LineIcon name={f.icon} className="h-6 w-6" />
                </div>
                <h3 className="text-[17px] font-semibold text-[#E2E5E9]">{f.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#8a8f96]">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Social proof */}
        <SocialProof />

        {/* Final CTA */}
        <FinalCTA onStart={() => openAuth("signup")} />
      </main>

      <footer className="border-t border-[#E2E5E9]/5 py-8 text-center text-[12px] text-[#8a8f96]">
        {new Date().getFullYear()} Wisecast AB
      </footer>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} initialMode={authMode} />
    </div>
  );
}
