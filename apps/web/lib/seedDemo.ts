import { uid } from "./store";
import { generateMockStudents } from "./mockStudents";
import type { Klass, Prov, StudentResult, State } from "./store";

export function seedDemo(): State {
  const k1: Klass = {
    id: uid(),
    name: "NA22B – Fysik 1",
    subject: "Fysik",
    gradeLevel: "Gymnasiet åk 2",
    gradingParams:
      "Gör alltid 0.25 poängs avdrag om enhet saknas. Var extra noggrann med gällande siffror.",
    createdAt: new Date().toISOString(),
  };
  const k2: Klass = {
    id: uid(),
    name: "MA21C – Matematik 3c",
    subject: "Matematik",
    gradeLevel: "Gymnasiet åk 3",
    gradingParams:
      "Kräv tydlig motivering vid varje steg. Godkänn alternativa lösningsmetoder om resonemanget håller.",
    createdAt: new Date().toISOString(),
  };

  // Mock-demo prov för NA22B
  const prov1: Prov = {
    id: uid(),
    klassId: k1.id,
    title: "Prov 1 – Mekanik & Energi",
    facit: "Uppgift 1: v = 29.4 m/s, kinematik (2p)\nUppgift 2: F = 10 N, Newtons 2:a lag (2p)\nUppgift 3: Ep = 98 J, potentiell energi (2p)\nUppgift 4: p = mv = 15 kg⋅m/s, rörelsemängd (2p)\nUppgift 5: W = Fs = 50 J, arbete (2p)\nTotal: 10p",
    customParams: "Gör alltid 0.25 poängs avdrag om enhet saknas. Var extra noggrann med gällande siffror. Ge tydlig pedagogisk feedback.",
    createdAt: new Date().toISOString(),
    status: "ready",
    processingProgress: 1,
    processingPhase: "completed",
  };

  const demoResults = generateMockStudents(prov1.id);
  return { klasser: [k1, k2], prov: [prov1], results: demoResults };
}
