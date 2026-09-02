"use client";

// DRAFT — kräver juristgranskning innan publicering.

import { motion } from "framer-motion";
import PageHeader from "@/components/ui/PageHeader";

const SECTIONS = [
  {
    title: "Villkor",
    content: `WiseOS är ett AI-baserat beslutsstöd för provrättning som riktar sig till lärare och skolor. Tjänsten tillhandahålls uteslutande som personuppgiftsbiträde (Processor) — skolan/läraren är personuppgiftsansvarig (Controller). Endast lärare skapar konton; elever loggar aldrig in. All AI-föreslagen poäng ska granskas av läraren innan den publiceras.`,
  },
  {
    title: "Användning",
    content: `Läraren ansvarar för att det finns rättslig grund för behandling av elevernas personuppgifter. WiseOS lagrar elevens namn, identifierare, transkriptioner av elevens arbete, poäng och AI-genererad feedback. Data sparas i en SQLite-databas. Klasser, elever, prov och individuella resultat kan raderas permanent av läraren via API:t. Råa provbilder bearbetas i minnet och returneras som data-URL:ar; de lagras inte på disk i backenden.`,
  },
  {
    title: "Integritet",
    content: `• Retention: GradingResult-rader (elevresultat med transkription, poäng, feedback) pseudonymiseras efter 30 dagar — elevnamn och identifierare ersätts av en slumpmässig pseudonym, så att pedagogiskt innehåll kan behållas för statistik. Efter 90 dagar raderas raden helt (hard delete). Klass/Test/KlassStudent-data raderas inte automatiskt utan endast på lärarens explicita begäran.
• PII-scrubbing: fritext som skickas till externa AI-tjänster (t.ex. rättningsinstruktioner, elevens svar i text) maskeras för personnummer, e-postadresser, telefonnummer och vissa namnliknande mönster. Heuristiken fångar inte alltid riktiga namn; därför ska fritext fortfarande granskas.
• Bilder: skannade provsidor/handstil skickas oskrubbat till Google Gemini för tolkning. Inget personuppgiftsbiträdesavtal (DPA) är i dag på plats med Google, Groq eller Wolfram. Serverplats och jurisdiktion för dessa tjänster är ännu ej verifierade.
• Rättigheter: läraren kan när som helst radera hela klasser, enskilda elever, prov och enskilda resultat via API:t.
• Säkerhet: autentisering och ägandeskap (teacher_id) är obligatoriska för V2-endpoints. Applikationskoden innehåller inte egen kryptering av databasen i vila; sådan kryptering måste tillhandahållas av driftsmiljön.`,
  },
  {
    title: "Betalning",
    content: `WiseOS erbjuds enligt den prisplan du väljer. Alla betalningsvillkor och avbokningsrättigheter anges i samband med köp och i den aktuella prenumerationsöversikten.`,
  },
  {
    title: "Begränsning av ansvar",
    content: `WiseOS ansvarar inte för eventuella fel i bedömningar som inte har granskats av läraren. AI-rättning är ett beslutsstöd, inte en ersättning för professionellt omdöme.`,
  },
  {
    title: "Kontakt",
    content: `Har du frågor om villkoren, kontakta oss på support@wiseos.app.`,
  },
];

function LegalSection({ title, content, index }: { title: string; content: string; index: number }) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      className="mb-10"
    >
      <h2 className="mb-3 text-[18px] font-medium tracking-[-0.01em] text-ink">{title}</h2>
      <p className="text-[15px] leading-relaxed text-ink-secondary">{content}</p>
    </motion.article>
  );
}

export default function LegalPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 pb-24 pt-4">
      <PageHeader
        eyebrow="Juridik"
        title="Användarvillkor"
        subtitle="DRAFT — kräver juristgranskning innan publicering. Texten baseras på faktisk implementation och är inte slutgiltig juridisk rådgivning."
      />

      <section className="mt-12">
        {SECTIONS.map((section, i) => (
          <LegalSection key={section.title} title={section.title} content={section.content} index={i} />
        ))}
      </section>
    </div>
  );
}
