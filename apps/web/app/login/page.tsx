"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useInView, useScroll, useMotionValueEvent } from "framer-motion";
import Logo from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";
import LineIcon, { type IconName } from "@/components/LineIcon";
import Surface from "@/components/ui/Surface";

type AuthMode = "login" | "signup";

const subjects = ["Matte", "Fysik", "Kemi"];

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
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]'
        ) ?? []
      );
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
      } else if (
        event.shiftKey &&
        (document.activeElement === first || !dialog?.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog?.contains(document.activeElement))
      ) {
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
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      setLoading(false);
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
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
      <div
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        tabIndex={-1}
        className="relative max-h-[90svh] w-full max-w-[400px] overflow-y-auto rounded-2xl border border-ink-hairline bg-paper-elevated p-6 shadow-float"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2
            id="auth-title"
            className="text-[20px] font-medium tracking-[-0.01em] text-ink"
          >
            {mode === "login" ? "Välkommen tillbaka" : "Kom igång med WiseOS"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Stäng"
            type="button"
            className="text-ink-secondary hover:text-ink"
          >
            <LineIcon name="x" className="h-5 w-5" />
          </button>
        </div>

        {signupDone ? (
          <div className="space-y-4 text-center">
            <p className="text-[13.5px] leading-relaxed text-ink">
              Konto skapat! Kolla din e-post ({email}) för att bekräfta
              adressen innan du loggar in.
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
              <label
                htmlFor="email"
                className="mb-1.5 block text-[12.5px] font-medium text-ink-secondary"
              >
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
              <label
                htmlFor="password"
                className="mb-1.5 block text-[12.5px] font-medium text-ink-secondary"
              >
                Lösenord
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
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

            <button type="submit" disabled={loading} className="btn-primary w-full">
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
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
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

function Header({
  scrolled,
  openAuth,
}: {
  scrolled: boolean;
  openAuth: (mode: AuthMode) => void;
}) {
  return (
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed inset-x-0 top-0 z-50 h-16 border-b border-ink-hairline/5 bg-paper/80 backdrop-blur-xl transition-shadow duration-300 ${
        scrolled ? "shadow-soft" : "shadow-none"
      }`}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="group flex h-11 items-center gap-2">
          <Logo className="h-7 w-7 object-contain" alt="" />
          <span className="text-[15px] font-semibold leading-none tracking-tight text-ink">
            WiseOS
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => openAuth("login")}
            className="btn-tertiary px-4 py-2 text-[13px]"
          >
            Logga in
          </button>
          <button
            onClick={() => openAuth("signup")}
            className="btn-primary px-4 py-2 text-[13px]"
          >
            Kom igång
          </button>
        </div>
      </div>
    </motion.header>
  );
}

function ProductDemo({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative ${className}`}
      style={{ perspective: "1200px" }}
    >
      <div className="relative z-10 flex flex-col gap-3">
        {/* Original document */}
        <Surface
          className={`${
            compact ? "p-4" : "p-5"
          } overflow-hidden bg-paper-elevated shadow-card`}
        >
          <div className="flex items-center justify-between gap-3 border-b border-ink-hairline/5 pb-3">
            <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted">
              Originaluppgift
            </span>
            <span className="text-[11px] text-ink-muted">Uppgift 4</span>
          </div>
          <div className="mt-4 space-y-3">
            <p className={`${compact ? "text-[13px]" : "text-[14px]"} text-ink`}>
              Lös ekvationen och visa alla steg:
            </p>
            <div className="overflow-x-auto rounded-[10px] border border-ink-hairline/5 bg-paper px-4 py-3 font-serif text-ink">
              <p className={compact ? "text-[15px]" : "text-[17px]"}>
                2x + 5 = 17
              </p>
              <p className="mt-2 text-ink-secondary">
                x = ?
              </p>
            </div>
            <div
              className={`rounded-[10px] border border-ink-hairline/5 bg-paper-secondary p-4 ${
                compact ? "text-[13px]" : "text-[14px]"
              } text-ink`}
            >
              <p>2x = 17 − 5</p>
              <p>2x = 12</p>
              <p className="font-medium">x = 6</p>
            </div>
          </div>
        </Surface>

        {/* Assessment panel */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <Surface
            className={`${
              compact ? "p-4" : "p-5"
            } overflow-hidden border-l-4 border-l-state-success bg-paper-elevated shadow-card`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted">
                  Bedömning
                </span>
                <h4 className={`mt-1 font-medium text-ink ${compact ? "text-[14px]" : "text-[16px]"}`}>
                  Korrekt lösningsgång
                </h4>
              </div>
              <div className="flex items-baseline gap-1.5 text-ink">
                <span className={`font-semibold tabular-nums ${compact ? "text-[22px]" : "text-[26px]"}`}>
                  2
                </span>
                <span className="text-[13px] text-ink-muted">/ 2</span>
              </div>
            </div>
            <p
              className={`mt-3 leading-relaxed text-ink-secondary ${
                compact ? "text-[12px]" : "text-[13px]"
              }`}
            >
              Alla steg är redovisade och slutsvaret är rätt.
            </p>
            <div className="mt-4 flex items-center gap-2 text-[12px] text-ink-muted">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-state-success" />
              Granskad av lärare
            </div>
          </Surface>
        </motion.div>
      </div>
    </div>
  );
}

function Hero({ openAuth }: { openAuth: (mode: AuthMode) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <section
      ref={ref}
      className="relative overflow-hidden bg-paper pb-24 pt-32 md:min-h-screen md:pb-32 md:pt-40"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative z-10 flex flex-col justify-center">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted"
            >
              Mindre administration. Mer undervisning.
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 text-[42px] font-medium leading-[1.05] tracking-[-0.03em] text-ink md:text-[56px] lg:text-[68px]"
            >
              Rätta smartare.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="mt-2 text-[24px] font-light leading-[1.25] tracking-[-0.01em] text-ink-secondary md:text-[32px]"
            >
              Lägg tiden på eleverna.
            </motion.p>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-md text-[16px] leading-relaxed text-ink-secondary"
            >
              WiseOS använder AI för att läsa, förstå och bedöma handskrivna
              elevlösningar — med läraren i kontroll över varje poäng och
              varje beslut.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 flex flex-wrap items-center gap-3"
            >
              <button
                onClick={() => openAuth("signup")}
                className="btn-primary px-7 py-3.5"
              >
                Kom igång
              </button>
              <button
                onClick={() => openAuth("login")}
                className="btn-secondary px-7 py-3.5"
              >
                Logga in
              </button>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 text-[13px] text-ink-muted"
            >
              {subjects.join(" · ")}
            </motion.p>
          </div>

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
        </div>
      </div>
    </section>
  );
}

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`py-24 md:py-32 ${className}`}>{children}</section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-ink-muted">
      {children}
    </p>
  );
}

function SectionTitle({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="mb-12 md:mb-16">
      <h2 className="text-[32px] font-medium leading-[1.1] tracking-[-0.025em] text-ink md:text-[44px] lg:text-[52px]">
        {children}
      </h2>
      {subtitle && (
        <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-secondary md:text-[18px]">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Problem() {
  const realities = [
    "Jag vet vad jag vill lägga min söndag på. Det är inte att rätta 60 prov.",
    "Varje elevs lösning måste förstås. Inte bara slutsvaret.",
    "Jag vill kunna lita på AI:n — men jag vill fortfarande bestämma.",
  ];

  return (
    <Section className="bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6">
        <Eyebrow>Problemet</Eyebrow>
        <SectionTitle subtitle="Rättning är nödvändig. Men den borde inte ta så stor del av lärarens tid.">
          Rättning tar tid.
          <br />
          <span className="text-ink-secondary">För mycket tid.</span>
        </SectionTitle>

        <div className="grid gap-6 md:grid-cols-3">
          {realities.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="border-t-2 border-ink-hairline/10 pt-6"
            >
              <p className="text-[17px] leading-relaxed text-ink md:text-[18px]">
                {r}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function OldWay() {
  const steps = [
    "Prov",
    "Pappershög",
    "Läs",
    "Räkna",
    "Kontrollera",
    "Skriv feedback",
    "Upprepa",
  ];

  return (
    <Section>
      <div className="mx-auto max-w-4xl px-6 text-center">
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-4 md:gap-6">
              <span className="text-[14px] font-medium uppercase tracking-[0.1em] text-ink-muted">
                {s}
              </span>
              {i < steps.length - 1 && (
                <span className="text-ink-hairline/30">
                  <LineIcon name="chevron-down" className="h-4 w-4 -rotate-90 md:rotate-0" />
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="mt-16">
          <h3 className="text-[28px] font-medium leading-[1.1] tracking-[-0.02em] text-ink md:text-[36px]">
            Det borde inte behöva fungera så.
          </h3>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-ink-secondary">
            WiseOS tar hand om det repetitiva arbetet runt bedömningen — så att
            läraren kan fokusera på det som kräver en lärare.
          </p>
        </div>
      </div>
    </Section>
  );
}

function Steps() {
  const steps = [
    {
      n: "01",
      title: "Ladda upp",
      desc: "En provbunt som PDF eller bilder.",
    },
    {
      n: "02",
      title: "Förstå",
      desc: "WiseOS identifierar frågor, elevsvar och relevant innehåll.",
    },
    {
      n: "03",
      title: "Bedöm",
      desc: "AI hjälper till att bedöma lösningen utifrån dina regler.",
    },
    {
      n: "04",
      title: "Granska",
      desc: "Du ser underlaget, justerar vid behov och godkänner.",
    },
  ];

  return (
    <Section className="bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6">
        <Eyebrow>Så fungerar WiseOS</Eyebrow>
        <SectionTitle>Från prov till färdiga resultat.</SectionTitle>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex flex-col"
            >
              <span className="text-[13px] font-medium text-ink-muted">
                {s.n}
              </span>
              <h3 className="mt-3 text-[20px] font-medium text-ink">
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function ProductProof({ openAuth }: { openAuth: (mode: AuthMode) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });

  return (
    <div ref={ref}>
      <Section>
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <Eyebrow>Produktvy</Eyebrow>
            <h2 className="mt-4 text-[32px] font-medium leading-[1.1] tracking-[-0.025em] text-ink md:text-[44px]">
              AI gör grovjobbet.
              <br />
              <span className="text-ink-secondary">Du behåller kontrollen.</span>
            </h2>
            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-ink-secondary">
              WiseOS hjälper dig att förstå och bedöma elevens faktiska arbete.
              Du granskar resultatet innan du godkänner.
            </p>
            <div className="mt-8">
              <button
                onClick={() => openAuth("signup")}
                className="btn-primary px-7 py-3.5"
              >
                Se hur det fungerar
              </button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProductDemo />
          </motion.div>
        </div>
      </div>
    </Section>
  </div>
  );
}

function Control() {
  const features = [
    {
      title: "Förstår hela lösningen",
      desc: "Inte bara slutsvaret.",
    },
    {
      title: "Poäng per fråga",
      desc: "Tydlig och kontrollerbar poängsättning.",
    },
    {
      title: "Originalet finns kvar",
      desc: "Elevens ursprungliga arbete visas alltid bredvid bedömningen.",
    },
    {
      title: "Du bestämmer",
      desc: "AI assisterar. Läraren fattar det slutgiltiga beslutet.",
    },
  ];

  return (
    <Section className="bg-paper-raised">
      <div className="mx-auto max-w-6xl px-6">
        <Eyebrow>Kontroll</Eyebrow>
        <SectionTitle>Byggt för att läraren ska ha kontroll.</SectionTitle>

        <div className="grid gap-px bg-ink-hairline/10 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{
                duration: 0.6,
                delay: i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="bg-paper-raised p-8"
            >
              <h3 className="text-[18px] font-medium text-ink">{f.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Stem() {
  return (
    <Section>
      <div className="mx-auto max-w-4xl px-6 text-center">
        <Eyebrow>Fokus</Eyebrow>
        <h2 className="mt-4 text-[32px] font-medium leading-[1.1] tracking-[-0.025em] text-ink md:text-[44px]">
          Börjar med de svåraste proven.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-[16px] leading-relaxed text-ink-secondary">
          WiseOS börjar med handskrivna lösningar i matte, fysik och kemi — där
          formler, uträkningar och resonemang gör bedömning särskilt
          tidskrävande.
        </p>
        <p className="mt-8 text-[14px] font-medium text-ink-muted">
          Det är början.
        </p>
      </div>
    </Section>
  );
}

function FinalCTA({ openAuth }: { openAuth: (mode: AuthMode) => void }) {
  return (
    <Section className="bg-paper-raised">
      <div className="mx-auto max-w-4xl px-6 text-center">
        <h2 className="text-[36px] font-medium leading-[1.1] tracking-[-0.03em] text-ink md:text-[52px]">
          Mer tid för undervisning.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-[17px] leading-relaxed text-ink-secondary">
          Rätta mindre. Se mer. Undervisa mer.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => openAuth("signup")}
            className="btn-primary px-8 py-4 text-[15px]"
          >
            Kom igång
          </button>
          <button
            onClick={() => openAuth("login")}
            className="btn-secondary px-8 py-4 text-[15px]"
          >
            Logga in
          </button>
        </div>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-ink-hairline/5 py-10 text-center text-[12px] text-ink-muted">
      <p>Wisecast AB © 2026</p>
    </footer>
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
    <div className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <Header scrolled={scrolled} openAuth={openAuth} />

      <main>
        <Hero openAuth={openAuth} />
        <Problem />
        <OldWay />
        <Steps />
        <ProductProof openAuth={openAuth} />
        <Control />
        <Stem />
        <FinalCTA openAuth={openAuth} />
      </main>

      <Footer />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}
