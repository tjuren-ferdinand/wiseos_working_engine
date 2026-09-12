"use client";

import { useState } from "react";
import Link from "next/link";
import Workbench from "@/components/Workbench";
import Logo from "@/components/Logo";
import type { StudentResult, Prov, Klass } from "@/lib/store";
import "katex/dist/katex.min.css";

// ---------------------------------------------------------------------------
// Mockdata — speglar det skannade exemplet i /demo/demo-exam-scan.png
// (Namn: A. Andersson, Klass: NA1 — fyra uppgifter)
// ---------------------------------------------------------------------------

const mockSteps = [
  {
    id: "step-1",
    questionId: "1",
    label: "Uppgift 1",
    questionText:
      "En bil accelererar från stillastående till 20 m/s på 5 sekunder. Beräkna accelerationen.",
    maxPoints: 2,
    earnedPoints: 2,
    status: "correct" as const,
    studentWork: "a = Δv/t = (20 m/s − 0 m/s) / 5 s = 4 m/s²",
    correctAnswer: "a = 4 m/s²",
    feedback: `**Feedback** 1. **Var eleven gjorde fel?** – Det finns inget fel i beräkningen. Resultatet 4 m/s² är korrekt. 2. **Rätt tillvägagångssätt** – Du använde formeln \\(a=\\frac{\\Delta v}{t}\\). – \\(\\Delta v = 20\\text{ m/s} - 0\\text{ m/s}=20\\text{ m/s}\\). – \\(a = \\frac{20\\text{ m/s}}{5\\text{ s}} = 4\\text{ m/s}^2\\). – Du skrev svaret tydligt två gånger, vilket visar tydlighet. 3. **Beröm** – Du använde rätt formel och gjorde beräkningen exakt. – Att du skrev svaret både i formeln och som slutresultat visar att du förstår processen. 4. **Liknande övning** – En bil accelererar från 0 till 30 m/s på 6 sekunder. Vad är accelerationen? – Lösningen: \\(a=\\frac{30}{6}=5\\text{ m/s}^2\\). Bra jobbat! Fortsätt så!`,
    found: true,
    transcriptionConfidence: 0.94,
    annotation: {
      summary:
        "Eleven visar full förståelse för accelerationsformeln \\(a=\\frac{\\Delta v}{t}\\) och använder den korrekt.",
      evidence: [
        "Korrekt identifiering av \\(v_0=0\\), \\(v=20\\) m/s och \\(t=5\\) s",
        "Rätt tillämpning av formeln \\(a=\\frac{v-v_0}{t}\\)",
        "Korrekt enhetsanalys med svar i m/s²",
      ],
      issues: [],
      suggestions: [
        "Träna på att lösa liknande problem med olika hastigheter och tider",
      ],
    },
    mathVerification: {
      provider: "wolfram",
      status: "verified" as const,
      isEquivalent: true,
      confidence: 0.95,
      message:
        "Elevens svar \\(a=4\\ \\text{m/s}^2\\) är matematiskt ekvivalent med facit.",
    },
  },
  {
    id: "step-2",
    questionId: "2",
    label: "Uppgift 2",
    questionText:
      "En kropp faller fritt från en höjd på 45 m. Hur lång tid tar det innan den når marken? (g = 9,8 m/s²)",
    maxPoints: 3,
    earnedPoints: 3,
    status: "needs_review" as const,
    studentWork:
      "h = ½gt² ⇒ t = √(2h/g) = √(2·45/9,8) = √(90/9,8), t ≈ √9,18 ≈ 3,03 s",
    correctAnswer: "t ≈ 3,03 s",
    feedback: `**Feedback** 1. **Ingen fel** – din beräkning är helt korrekt. Du använde formeln \\(h=\\frac{1}{2}gt^2\\) och löste för \\(t\\) på rätt sätt. 2. **Rätt tillvägagångssätt** \\[ t=\\sqrt{\\frac{2h}{9,8}}=\\sqrt{\\frac{2\\cdot45}{9,8}}\\approx\\sqrt{9,18}\\approx3,03\\text{ s} \\] Detta ger samma resultat som den givna lösningen (≈3,0 s). 3. **Bra jobbat** – du skrev tydligt varje steg, använde korrekta enheter och avrundade på ett rimligt sätt. 4. **Liknande övning** *En bil accelererar med konstant acceleration \\(a=3\\,\\text{m/s}^2\\). Hur långt färdas den efter 8 s?* (Använd \\(s=\\frac{1}{2}at^2\\).)`,
    found: true,
    transcriptionConfidence: 0.62,
    annotation: {
      summary:
        "Lösningen ser korrekt ut men AI:n är osäker på handstilen i mellersta steget.",
      evidence: [
        "Korrekt samband \\(h=\\frac{1}{2}gt^2\\)",
        "Rätt omskrivning \\(t=\\sqrt{\\frac{2h}{g}}\\)",
      ],
      issues: [],
      suggestions: [],
    },
    mathVerification: {
      provider: "wolfram",
      status: "verified" as const,
      isEquivalent: true,
      confidence: 0.9,
      message:
        "Numeriskt svar \\(t\\approx3,03\\ \\text{s}\\) är ekvivalent med facit.",
    },
  },
  {
    id: "step-3",
    questionId: "3",
    label: "Uppgift 3",
    questionText:
      "En kraft på 50 N verkar på en kropp. Vad blir accelerationen om massan är 10 kg?",
    maxPoints: 2,
    earnedPoints: 2,
    status: "correct" as const,
    studentWork: "a = F/m = 50 N / 10 kg = 5 m/s²",
    correctAnswer: "a = 5 m/s²",
    feedback: `**Feedback** 1. **Ingen fel** – eleven tillämpar Newtons andra lag \\(F=ma\\) korrekt. 2. **Rätt tillvägagångssätt** – Omskrivningen \\(a=\\frac{F}{m}\\) är rätt. – Insättningen \\(\\frac{50\\text{ N}}{10\\text{ kg}}=5\\text{ m/s}^2\\) är korrekt. 3. **Beröm** – Tydlig och koncis lösning med korrekt enhet.`,
    found: true,
    transcriptionConfidence: 0.96,
    annotation: {
      summary:
        "Korrekt användning av \\(a=\\frac{F}{m}\\) med rätt svar \\(5\\ \\text{m/s}^2\\).",
      evidence: [
        "Korrekt formel \\(a=\\frac{F}{m}\\)",
        "Rätt beräkning \\(\\frac{50}{10}=5\\)",
      ],
      issues: [],
      suggestions: [],
    },
    mathVerification: {
      provider: "wolfram",
      status: "verified" as const,
      isEquivalent: true,
      confidence: 0.97,
      message:
        "Elevens svar \\(a=5\\ \\text{m/s}^2\\) är matematiskt ekvivalent med facit.",
    },
  },
  {
    id: "step-4",
    questionId: "4",
    label: "Uppgift 4",
    questionText: "Lös ekvationen och visa alla steg: 2x + 5 = 17",
    maxPoints: 2,
    earnedPoints: 2,
    status: "correct" as const,
    studentWork: "2x = 17 − 5, 2x = 12, x = 6",
    correctAnswer: "x = 6",
    feedback: `**Feedback** 1. **Ingen fel** – alla steg är redovisade och slutsvaret är rätt. 2. **Rätt tillvägagångssätt** – Eleven isolerar \\(x\\) korrekt: först \\(2x=17-5\\), sedan \\(2x=12\\), slutligen \\(x=6\\). 3. **Beröm** – Tydlig stegvis redovisning — exakt det som efterfrågades. 4. **Liknande övning** *Prova en något svårare ekvation: \\(3x-7=14\\).*`,
    found: true,
    transcriptionConfidence: 0.93,
    annotation: {
      summary:
        "Alla steg är redovisade och slutsvaret \\(x=6\\) är korrekt.",
      evidence: [
        "Korrekt isolering av \\(x\\)",
        "Rätt slutvärde \\(x=6\\)",
      ],
      issues: [],
      suggestions: [],
    },
    mathVerification: {
      provider: "wolfram",
      status: "verified" as const,
      isEquivalent: true,
      confidence: 0.98,
      message:
        "Elevens svar \\(x=6\\) är matematiskt ekvivalent med facit.",
    },
  },
];

const mockResult: StudentResult = {
  id: "demo-result-1",
  provId: "demo-prov-1",
  studentId: "demo-student-1",
  studentName: "A. Andersson",
  identificationMethod: "name_field",
  identificationConfidence: 0.95,
  steps: mockSteps,
  totalScore: 9,
  maxScore: 9,
  percentage: 100,
  grade: "A",
  feedback: "",
  scannedAt: new Date().toISOString(),
  gradedAt: new Date().toISOString(),
  scanPages: ["/demo/demo-exam-scan.png"],
};

const mockProv: Prov = {
  id: "demo-prov-1",
  klassId: "demo-klass-1",
  title: "Fysikprov — Rörelse och energi",
  date: new Date().toISOString(),
  maxPoints: 9,
  facitMode: "uploaded",
  customParams: "",
  questions: [
    { id: "q-1", number: "1", maxPoints: 2 },
    { id: "q-2", number: "2", maxPoints: 3 },
    { id: "q-3", number: "3", maxPoints: 2 },
    { id: "q-4", number: "4", maxPoints: 2 },
  ],
  status: "review",
  createdAt: new Date().toISOString(),
};

const mockKlass: Klass = {
  id: "demo-klass-1",
  name: "NA1 Fysik 1",
  kursId: "demo-kurs-1",
  students: [{ id: "demo-student-1", name: "A. Andersson" }],
  gradingParams: {
    allowPartialCredit: true,
    unitErrorPenalty: 0.5,
    roundingTolerance: 5,
    requireWorkShown: true,
    significantFigures: false,
    customRules: [],
  },
  gradeThresholds: { A: 90, B: 80, C: 70, D: 60, E: 50, F: 0 },
};

// ---------------------------------------------------------------------------
// Demo-sida
// ---------------------------------------------------------------------------

export default function DemoPage() {
  const [result] = useState(mockResult);

  return (
    <div className="min-h-screen bg-paper">
      {/* Demo-banner */}
      <div className="sticky top-0 z-50 border-b border-ink-hairline/10 bg-paper-elevated/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-3">
            <Logo className="h-6 w-6 object-contain" alt="" />
            <span className="text-[13px] font-medium text-ink-secondary">
              Interaktiv demo med exempeldata
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-[12px] text-ink-muted sm:block">
              Just nu tillgängligt för utvalda pilotskolor
            </span>
            <Link
              href="/login"
              className="btn-primary px-4 py-2 text-[13px]"
            >
              Begär åtkomst
            </Link>
          </div>
        </div>
      </div>

      {/* Workbench */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Workbench
          result={result}
          prov={mockProv}
          klass={mockKlass}
          onBack={() => window.history.back()}
          onPrint={() => {}}
        />
      </div>

      {/* Footer */}
      <footer className="border-t border-ink-hairline/5 py-8 text-center text-[12px] text-ink-muted">
        <p>Wisecast AB © 2026 · Demo med exempeldata</p>
      </footer>
    </div>
  );
}
