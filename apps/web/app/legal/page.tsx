"use client";

import { motion } from "framer-motion";
import PageHeader from "@/components/ui/PageHeader";

const SECTIONS = [
  {
    title: "Villkor",
    content: `WiseOS tillhandahålls som ett verktyg för lärare att spara tid på provrättning. Tjänsten får användas i undervisningssyfte och i enlighet med gällande lag. All användning av tjänsten sker på eget ansvar och vi rekommenderar att du alltid granskar och godkänner AI-föreslagna poäng innan du publicerar resultat till elever.`,
  },
  {
    title: "Användning",
    content: `Du ansvarar för att innehåll du laddar upp, såsom prov och personuppgifter, hanteras i enlighet med din skolas riktlinjer och dataskyddsförordningen. WiseOS sparar och lagrar bara data så länge det är nödvändigt för att genomföra rättningen.`,
  },
  {
    title: "Integritet",
    content: `Vi tar dataskydd på största allvar. Personuppgifter behandlas säkert, krypteras i transport och vila, och rensas efter avslutad rättning. WiseOS använder ledande molntjänster och följer GDPR.`,
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
        subtitle="Här hittar du villkoren för att använda WiseOS. Läs igenom dem noggrant."
      />

      <section className="mt-12">
        {SECTIONS.map((section, i) => (
          <LegalSection key={section.title} title={section.title} content={section.content} index={i} />
        ))}
      </section>
    </div>
  );
}
