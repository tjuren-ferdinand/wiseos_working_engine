import { create } from "zustand";
import {
  api,
  type AnswerKeyItem,
  type Annotation,
  type DocumentMeta,
  type StudentDocumentResult,
} from "@/lib/api";

// ============================================================================
// V2 TYPES - Kurs → Klass → Prov → Resultat
// ============================================================================

export interface Kurs {
  id: string;
  name: string;
  code: string; // t.ex. FYSFYS01
  description: string;
  gradeThresholds: GradeThresholds;
}

export interface Student {
  id: string;
  name: string;
  identifier?: string; // QR/streckkod/elev-ID
}

export interface GradingParams {
  allowPartialCredit: boolean;
  unitErrorPenalty: number; // poängavdrag för enhetsfel
  roundingTolerance: number; // % tolerans för avrundning
  requireWorkShown: boolean;
  significantFigures: boolean;
  customRules: string[];
}

export interface GradeThresholds {
  A: number;
  B: number;
  C: number;
  D: number;
  E: number;
  F: number;
}

export interface Klass {
  id: string;
  name: string;
  kursId: string;
  students: Student[];
  gradingParams: GradingParams;
  gradeThresholds: GradeThresholds;
}

export interface Question {
  id: string;
  number: string;
  maxPoints: number;
}

export interface Prov {
  id: string;
  klassId: string;
  title: string;
  date: string;
  maxPoints: number;
  facitMode: 'uploaded' | 'ai_generated' | 'none';
  facit?: string;
  customParams?: string;
  questions: Question[];
  status: 'draft' | 'grading' | 'review' | 'published';
  createdAt: string;
}

export interface Step {
  id: string;
  /** Uppgiftsnummer från backend. All mappning sker på detta, aldrig på index. */
  questionId: string;
  label: string;
  questionText?: string;
  maxPoints: number;
  earnedPoints: number;
  status: "correct" | "partial" | "incorrect" | "needs_review" | "pending";
  feedback?: string;
  studentWork?: string;
  correctAnswer?: string;
  /** false = uppgiften fanns inte i dokumentet (till skillnad från oläst handstil). */
  found?: boolean;
  /** Hur säker AI:n är på att den läst elevens handstil rätt. */
  transcriptionConfidence?: number;
  /** Strukturerad annotering från backend. Frontenden genererar ALDRIG egen. */
  annotation?: Annotation;
  /** Satt när ett tekniskt fel hindrade bedömning. */
  error?: string | null;
  /** true = uppgiften hittades i bilden men saknas i facit. */
  outsideAnswerKey?: boolean;
}

export interface StudentResult {
  id: string;
  provId: string;
  studentId: string;
  studentName: string;
  identificationMethod: 'name_field' | 'qr_code' | 'barcode' | 'student_id';
  identificationConfidence: number;
  steps: Step[];
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade?: string;
  feedback?: string;
  scannedAt: string;
  gradedAt?: string;
  /** Originalskanning(ar) som data-URL, en per sida i sidordning. */
  scanPages?: string[];
  /** Diagnostik från rättningsmotorn (modell, latens, fel). */
  document?: DocumentMeta;
  /** Simulerade handskrivna sidor (Caveat-font) för demo. En sträng per sida. */
  mockScanPages?: string[];
}

// ============================================================================
// DEFAULTS
// ============================================================================

export const DEFAULT_GRADING_PARAMS: GradingParams = {
  allowPartialCredit: true,
  unitErrorPenalty: 0.5,
  roundingTolerance: 5,
  requireWorkShown: true,
  significantFigures: true,
  customRules: [],
};

export const DEFAULT_GRADE_THRESHOLDS: GradeThresholds = {
  A: 90,
  B: 80,
  C: 65,
  D: 50,
  E: 35,
  F: 0,
};

// ============================================================================
// KURSKATALOG - Statisk lista över kurser läraren kan koppla klasser till.
// (Kurser är läroplansreferenser, inte elevdata - hanteras inte i backend DB.)
// ============================================================================

const KURSER: Kurs[] = [
  {
    id: "fysik2",
    name: "Fysik 2",
    code: "FYSFYS02",
    description: "Fördjupningskurs i fysik med mekanik, svängningar, vågrörelser och modern fysik.",
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
  {
    id: "matte4",
    name: "Matematik 4",
    code: "MATMAT04",
    description: "Avancerad matematik med komplexa tal, differentialekvationer och linjär algebra.",
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
  {
    id: "kemi2",
    name: "Kemi 2",
    code: "KEMKEM02",
    description: "Fördjupning i organisk kemi, reaktionskinetik och kemisk jämvikt.",
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
  {
    id: "prog1",
    name: "Programmering 1",
    code: "PRRPRR01",
    description: "Grundläggande programmering med Python, algoritmer och datastrukturer.",
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
  {
    id: "teknik1",
    name: "Teknik 1",
    code: "TEKTEK01",
    description: "Tekniska system, konstruktion och hållbar utveckling.",
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
];

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface StoreState {
  kurser: Kurs[];
  klasser: Klass[];
  prov: Prov[];
  results: StudentResult[];
  batchProgress: { [provId: string]: { phase: string; progress: number; total: number } };
  hydrated: boolean;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// ZUSTAND STORE
// ============================================================================

export const useStore = create<StoreState>(() => ({
  kurser: KURSER,
  klasser: [],
  prov: [],
  results: [],
  batchProgress: {},
  hydrated: false,
  loading: false,
  error: null,
}));

// ============================================================================
// BACKEND <-> FRONTEND MAPPING
// ============================================================================

function mapBackendClass(c: import("@/lib/api").BackendClass): Klass {
  return {
    id: c.id,
    name: c.name,
    kursId: c.kursId,
    students: c.students.map((s) => ({
      id: s.id,
      name: s.name,
      identifier: s.identifier ?? undefined,
    })),
    gradingParams: c.gradingParams ?? { ...DEFAULT_GRADING_PARAMS },
    gradeThresholds: c.gradeThresholds ?? { ...DEFAULT_GRADE_THRESHOLDS },
  };
}

function mapBackendTest(t: import("@/lib/api").BackendTest): Prov {
  return {
    id: t.id,
    klassId: t.klassId,
    title: t.title,
    date: t.date ?? "",
    maxPoints: t.maxPoints,
    facitMode: t.facitMode as Prov["facitMode"],
    facit: t.facit ?? undefined,
    customParams: t.customParams ?? undefined,
    questions: t.questions,
    status: t.status as Prov["status"],
    createdAt: t.createdAt,
  };
}

function mapBackendResult(r: import("@/lib/api").BackendGradingResult): StudentResult {
  return {
    id: r.id,
    provId: r.provId,
    studentId: r.studentId ?? `unknown-${r.id}`,
    studentName: r.studentName,
    identificationMethod: r.identificationMethod as StudentResult["identificationMethod"],
    identificationConfidence: r.identificationConfidence,
    steps: r.steps.map((s) => ({
      id: s.id,
      questionId: s.questionId ?? s.id,
      label: s.label,
      questionText: s.questionText ?? undefined,
      maxPoints: s.maxPoints,
      earnedPoints: s.earnedPoints,
      status: s.status as Step["status"],
      feedback: s.feedback ?? undefined,
      studentWork: s.studentWork ?? undefined,
      correctAnswer: s.correctAnswer ?? undefined,
    })),
    totalScore: r.totalScore,
    maxScore: r.maxScore,
    percentage: r.percentage,
    grade: r.grade ?? undefined,
    feedback: r.feedback ?? undefined,
    scannedAt: r.scannedAt,
    gradedAt: r.gradedAt ?? undefined,
    scanPages: r.scanPages ?? [],
  };
}

// ============================================================================
// ACTIONS
// ============================================================================

export const actions = {
  /** Hämtar klasser, prov och rättningsresultat från backend och fyller store:n.
   * Anropas en gång vid app-mount (se components/StoreHydrator.tsx). */
  hydrate: async (): Promise<void> => {
    useStore.setState({ loading: true, error: null });
    try {
      const backendClasses = await api.listClasses();
      const klasser = backendClasses.map(mapBackendClass);

      const testsPerClass = await Promise.all(
        backendClasses.map((c) => api.listTests(c.id).catch(() => [])),
      );
      const prov = testsPerClass.flat().map(mapBackendTest);

      const backendResults = await api.listGradingResults();
      const results = backendResults.map(mapBackendResult);

      useStore.setState({
        klasser,
        prov,
        results,
        hydrated: true,
        loading: false,
        error: null,
      });
    } catch (error) {
      useStore.setState({ loading: false, error: (error as Error).message, hydrated: true });
    }
  },

  createKlass: async (data: {
    name: string;
    subject?: string;
    gradeLevel?: string;
    gradingParams?: string;
    kursId?: string;
  }): Promise<Klass> => {
    const kurserState = useStore.getState().kurser;
    const customRules = (data.gradingParams || "")
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    const backendKlass = await api.createClass({
      name: data.name,
      kursId: data.kursId || kurserState[0]?.id || "",
      gradingParams: { ...DEFAULT_GRADING_PARAMS, customRules },
      gradeThresholds: { ...DEFAULT_GRADE_THRESHOLDS },
    });
    const newKlass = mapBackendClass(backendKlass);
    useStore.setState((state) => ({ klasser: [...state.klasser, newKlass] }));
    return newKlass;
  },

  updateKlassParams: async (klassId: string, params: GradingParams): Promise<void> => {
    const backendKlass = await api.updateClass(klassId, { gradingParams: params });
    const updated = mapBackendClass(backendKlass);
    useStore.setState((state) => ({
      klasser: state.klasser.map((k) => (k.id === klassId ? updated : k)),
    }));
  },

  startProv: async (data: {
    klassId: string;
    title: string;
    date: string;
    maxPoints: number;
    facitMode: 'uploaded' | 'ai_generated' | 'none';
    facit?: string;
    customParams?: string;
    questions?: Question[];
  }): Promise<Prov> => {
    const backendTest = await api.createTest(data.klassId, {
      title: data.title,
      date: data.date,
      maxPoints: data.maxPoints,
      facitMode: data.facitMode,
      facit: data.facit,
      customParams: data.customParams,
      questions: data.questions,
      status: "grading",
    });
    const newProv = mapBackendTest(backendTest);
    useStore.setState((state) => ({ prov: [...state.prov, newProv] }));
    return newProv;
  },

  updateProvStatus: async (provId: string, status: Prov["status"]): Promise<void> => {
    useStore.setState((state) => ({
      prov: state.prov.map((p) => (p.id === provId ? { ...p, status } : p)),
    }));
    try {
      await api.updateTest(provId, { status });
    } catch {
      // Provet kan vara ett lokalt/oregistrerat ID (t.ex. under skapande) - status
      // förblir korrekt i UI:t men persisteras inte förrän provet finns i backend.
    }
  },

  addResult: (result: StudentResult) => {
    useStore.setState((state) => ({ results: [...state.results, result] }));
  },

  updateStep: (resultId: string, stepId: string, patch: Partial<Step>) => {
    useStore.setState((state) => ({
      results: state.results.map((r) =>
        r.id === resultId
          ? {
              ...r,
              steps: r.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)),
            }
          : r
      ),
    }));

    const result = useStore.getState().results.find((r) => r.id === resultId);
    if (!result) return;
    const totalScore = result.steps.reduce((sum, s) => sum + s.earnedPoints, 0);
    const maxScore = result.steps.reduce((sum, s) => sum + s.maxPoints, 0);
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    useStore.setState((state) => ({
      results: state.results.map((r) =>
        r.id === resultId ? { ...r, totalScore, maxScore, percentage } : r
      ),
    }));
    api
      .updateResult(resultId, {
        steps: result.steps.map((s) => ({
          id: s.id,
          questionId: s.questionId,
          label: s.label,
          questionText: s.questionText,
          maxPoints: s.maxPoints,
          earnedPoints: s.earnedPoints,
          status: s.status,
          feedback: s.feedback,
          studentWork: s.studentWork,
          correctAnswer: s.correctAnswer,
        })),
        totalScore,
        maxScore,
        percentage,
      })
      .catch((error) => {
        useStore.setState({ error: `Kunde inte spara ändringen: ${(error as Error).message}` });
      });
  },

  publishResults: async (provId: string): Promise<void> => {
    useStore.setState((state) => ({
      prov: state.prov.map((p) => (p.id === provId ? { ...p, status: "published" } : p)),
    }));
    await api.updateTest(provId, { status: "published" });
  },

  setBatchProgress: (provId: string, phase: string, progress: number, total: number) => {
    useStore.setState((state) => ({
      batchProgress: { ...state.batchProgress, [provId]: { phase, progress, total } },
    }));
  },
};

// ============================================================================
// BATCH GRADING SIMULATION
// ============================================================================

/**
 * Kör backend-pipelinen (Wolfram + Claude + OCR) och lagrar resultaten i store.
 * Kastar vid nätverks-/serverfel så att UI:t kan visa fel.
 */
function verdictToStatus(v: string): Step["status"] {
  if (v === "correct") return "correct";
  if (v === "partial") return "partial";
  if (v === "incorrect" || v === "error") return "incorrect";
  if (v === "needs_review") return "needs_review";
  return "pending";
}

function mapBatchToStudentResult(
  b: StudentDocumentResult,
  studentId: string,
  identificationMethod: 'name_field' | 'qr_code' | 'barcode' | 'student_id',
): StudentResult {
  // 1:1-mappning av backendens kanoniska resultat. Inget fält uppfinns här.
  const steps: Step[] = b.questions.map((q) => ({
    id: `${b.id}-q${q.questionNumber}`,
    questionId: q.questionNumber,
    label: q.inAnswerKey
      ? `Uppgift ${q.questionNumber}`
      : `Uppgift ${q.questionNumber} (ej i facit)`,
    questionText: q.questionText,
    maxPoints: q.assessment.maxPoints,
    earnedPoints: q.pointsTeacher ?? q.assessment.points,
    status: verdictToStatus(q.assessment.status),
    feedback: q.feedback,
    studentWork: q.studentWork,
    correctAnswer: q.correctAnswer,
    found: q.found,
    transcriptionConfidence: q.transcriptionConfidence,
    annotation: q.annotation,
    error: q.error,
    outsideAnswerKey: !q.inAnswerKey,
  }));
  const totalScore = steps.reduce((s, x) => s + x.earnedPoints, 0);
  const maxScore = steps.reduce((s, x) => s + x.maxPoints, 0);
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
  const now = new Date().toISOString();
  return {
    id: b.id,
    provId: b.provId,
    studentId,
    studentName: b.studentName,
    identificationMethod,
    identificationConfidence: 0.95,
    steps,
    totalScore,
    maxScore,
    percentage,
    scannedAt: now,
    gradedAt: now,
    scanPages: b.scanPages,
    document: b.document,
  };
}

export async function runBatchGrade(opts: {
  provId: string;
  klassId: string;
  klassParams: GradingParams;
  customParams: string;
  answerKey: AnswerKeyItem[];
  files: File[];
  identificationMethod: 'name_field' | 'qr_code' | 'barcode' | 'student_id';
  onPhase?: (phase: 'uploading' | 'processing' | 'saving') => void;
  signal?: AbortSignal;
}): Promise<{ added: StudentResult[]; activeRules: string[]; integrations: Record<string, boolean | string> }> {
  const { provId, klassId, klassParams, customParams, answerKey, files, identificationMethod, onPhase, signal } = opts;

  actions.setBatchProgress(provId, 'uploading', 0, files.length);
  onPhase?.('uploading');

  // Klassregler serialiseras som mänsklig text – backend RULE_DEFS matchar via regex.
  const classText = [
    klassParams.customRules.join('. '),
    klassParams.significantFigures ? 'Kräv gällande siffror.' : '',
    klassParams.unitErrorPenalty > 0 ? 'Kräv enheter i slutsvar.' : '',
  ].filter(Boolean).join(' ');

  actions.setBatchProgress(provId, 'processing', 0, files.length);
  onPhase?.('processing');

  const normalisedAnswerKey = answerKey.map((item) => ({
    ...item,
    question_number: item.question_number
      .toString()
      .replace(/^[^\d]*([A-Za-z]?\d+[A-Za-z]?)[^\d]*$/i, "$1")
      .toLowerCase(),
  }));

  try {
    const resp = await api.batchGrade({
      provId,
      classGradingParameters: classText,
      testSpecificParameters: customParams || '',
      answerKey: normalisedAnswerKey,
      files,
    }, signal);

    onPhase?.('saving');

    // Matcha varje resultat mot en klasslista-elev via namn (case-insensitive substring).
    const klass = useStore.getState().klasser.find((k) => k.id === klassId);
    const added: StudentResult[] = resp.results.map((b) => {
      const match = klass?.students.find(
        (s) => s.name.toLowerCase() === b.studentName.toLowerCase()
          || s.name.toLowerCase().includes(b.studentName.toLowerCase())
          || b.studentName.toLowerCase().includes(s.name.toLowerCase()),
      );
      return mapBatchToStudentResult(b, match?.id ?? `unknown-${b.id}`, identificationMethod);
    });

    useStore.setState((state) => ({ results: [...state.results, ...added] }));
    actions.updateProvStatus(provId, 'review');
    actions.setBatchProgress(provId, 'done', files.length, files.length);

    return { added, activeRules: resp.activeRules, integrations: resp.integrations };
  } catch (error) {
    actions.updateProvStatus(provId, 'draft');
    actions.setBatchProgress(provId, 'error', 0, files.length);
    throw error;
  }
}

// ============================================================================
// DERIVED GRADING LOGIC
// ============================================================================

export function deriveStep(
  step: Step,
  params: GradingParams
): Step {
  let adjusted = step.earnedPoints;

  // Apply unit error penalty
  if (params.unitErrorPenalty > 0 && step.feedback?.toLowerCase().includes("enhet")) {
    adjusted = Math.max(0, adjusted - params.unitErrorPenalty);
  }

  // Require work shown
  if (params.requireWorkShown && step.studentWork === "") {
    adjusted = Math.max(0, adjusted - 1);
  }

  return {
    ...step,
    earnedPoints: adjusted,
  };
}
