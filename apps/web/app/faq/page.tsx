"use client";

// DRAFT — kräver juristgranskning innan publicering.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "@/components/ui/PageHeader";

const FAQS = [
  {
    q: "Hur fungerar AI-rättningen i praktiken?",
    a: "Du laddar upp en provbunt. WiseOS läser varje lösning, bedömer den mot facit och lär känna ditt sätt att rätta. Resultatet presenteras i en överskådlig granskningsvy där du godkänner eller justerar varje poäng.",
  },
  {
    q: "Kan jag ändra poäng efter att AI har rättat?",
    a: "Ja. Du har full kontroll. Alla förslag går via dig innan resultatet publiceras till eleverna.",
  },
  {
    q: "Vilka ämnen stöds?",
    a: "WiseOS är byggt för svenska STEM-ämnen som matematik, fysik och kemi, med fokus på korrekt terminologi och bedömningsstöd.",
  },
  {
    q: "Är mina elevers data säker?",
    a: `DRAFT — kräver juristgranskning innan publicering. Tekniskt vidtar WiseOS flera åtgärder: endast inloggad lärare kan nå sin egen data (teacher_id-ägandeskap), fritext skrubbas för personnummer/e-post/telefon och vissa namnliknande mönster innan den skickas till extern AI, och resultat pseudonymiseras efter 30 dagar samt raderas permanent efter 90 dagar. Läraren kan också radera klasser, elever, prov och enskilda resultat manuellt. Viktiga begränsningar: skannade provsidor med elevhandstil skickas oskrubbat till Google Gemini; vi har inte tecknat DPA med Google, Groq eller Wolfram; och serverplats/jurisdiktion är inte verifierad. Granska därför integriteten med skolans dataskyddsombud innan användning.`,
  },
  {
    q: "Hur börjar jag?",
    a: "Skapa ett konto, skapa din första klass och ladda upp ett prov. Du kan prova WiseOS gratis utan bindningstid.",
  },
];

function FaqItem({ item, isOpen, onClick }: { item: typeof FAQS[0]; isOpen: boolean; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="border-b border-ink-hairline"
    >
      <button
        onClick={onClick}
        className="group flex w-full items-center justify-between py-5 text-left transition-colors"
      >
        <span className="text-[16px] font-medium text-ink transition-colors group-hover:text-accent">
          {item.q}
        </span>
        <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-hairline text-[13px] text-ink-secondary transition-all group-hover:border-accent/50 group-hover:text-accent">
          {isOpen ? "−" : "+"}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-[15px] leading-relaxed text-ink-secondary">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl px-6 pt-4">
      <PageHeader
        eyebrow="Vanliga frågor"
        title="Svar på det du undrar över"
        subtitle="DRAFT — kräver juristgranskning innan publicering. Svaren baseras på faktisk implementation och är inte slutgiltig rådgivning."
      />

      <section className="mt-12">
        {FAQS.map((item, i) => (
          <FaqItem
            key={item.q}
            item={item}
            isOpen={openIndex === i}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
          />
        ))}
      </section>
    </div>
  );
}
