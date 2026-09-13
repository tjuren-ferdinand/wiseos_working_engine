import { create } from "zustand";
import {
  api,
  type AnswerKeyItem,
  type Annotation,
  type DocumentMeta,
  type MathVerification,
  type StudentDocumentResult,
} from "@/lib/api";

// ============================================================================
// V2 TYPES - Kurs → Klass → Prov → Resultat
// ============================================================================

export interface Kurs {
  id: string;
  name: string;
  code: string; // t.ex. FYSFYS01
  subject: string;
  level?: string;
  description: string;
  gradeThresholds: GradeThresholds;
  isCustom?: boolean;
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
  mathVerification?: MathVerification;
  feedbackProvider?: string;
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
  /** Ursprungsfilnamn per sida — mappar uppladdade filkort mot rätt elevresultat. */
  sourceFiles?: string[];
  /** Diagnostik från rättningsmotorn (modell, latens, fel). */
  document?: DocumentMeta;
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
// KURSKATALOG - Statisk baslista som kompletteras med lärarens egna backendlagrade kurser.
// ============================================================================

// Svensk kurskatalog (gymnasiet + högstadiet). Kurskoder följer Skolverkets
// GY11-nomenklatur där sådan finns; övriga är generiska.
const KURSER: Kurs[] = [
  // Matematik
  { id: "matte1c", name: "Matematik 1c", code: "MATMAT01c", subject: "Matematik", level: "Gymnasiet", description: "Gymnasiematematik med algebra, funktioner och statistik.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "matte1b", name: "Matematik 1b", code: "MATMAT01b", subject: "Matematik", level: "Gymnasiet", description: "Matematik för samhälls- och ekonomiprogrammen.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "matte1a", name: "Matematik 1a", code: "MATMAT01a", subject: "Matematik", level: "Gymnasiet", description: "Matematik för estetiska och humanistiska program.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "matte2", name: "Matematik 2a/2b/2c", code: "MATMAT02", subject: "Matematik", level: "Gymnasiet", description: "Fortsättningskurs i matematik.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "matte3", name: "Matematik 3b/3c", code: "MATMAT03", subject: "Matematik", level: "Gymnasiet", description: "Funktioner, derivata, integraler och sannolikhet.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "matte4", name: "Matematik 4", code: "MATMAT04", subject: "Matematik", level: "Gymnasiet", description: "Avancerad matematik med komplexa tal, differentialekvationer och linjär algebra.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "matte5", name: "Matematik 5", code: "MATMAT05", subject: "Matematik", level: "Gymnasiet", description: "Fördjupning i matematisk analys.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "matte-spec", name: "Matematik – specialisering", code: "MATMAT00", subject: "Matematik", level: "Gymnasiet", description: "Fördjupningskurs inom ett valt matematiskt område.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  // Naturvetenskap
  { id: "fysik1", name: "Fysik 1", code: "FYSFYS01", subject: "Fysik", level: "Gymnasiet", description: "Mekanik, värme, vågor och ellära.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "fysik2", name: "Fysik 2", code: "FYSFYS02", subject: "Fysik", level: "Gymnasiet", description: "Fördjupningskurs i fysik med mekanik, svängningar, vågrörelser och modern fysik.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "kemi1", name: "Kemi 1", code: "KEMKEM01", subject: "Kemi", level: "Gymnasiet", description: "Grundläggande kemi med atom- och molekyllära.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "kemi2", name: "Kemi 2", code: "KEMKEM02", subject: "Kemi", level: "Gymnasiet", description: "Fördjupning i organisk kemi, reaktionskinetik och kemisk jämvikt.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "biologi1", name: "Biologi 1", code: "BIOBIO01", subject: "Biologi", level: "Gymnasiet", description: "Cell, genetik och ekologi.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "biologi2", name: "Biologi 2", code: "BIOBIO02", subject: "Biologi", level: "Gymnasiet", description: "Fysiologi, evolution och bioteknik.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "natkunskap1a", name: "Naturkunskap 1a", code: "NARNAT01a", subject: "Naturkunskap", level: "Gymnasiet", description: "Tvärvetenskaplig naturvetenskap för samhällsprogram.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "natkunskap1b", name: "Naturkunskap 1b", code: "NARNAT01b", subject: "Naturkunskap", level: "Gymnasiet", description: "Fortsättningskurs i naturvetenskap.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  // Teknik & data
  { id: "teknik1", name: "Teknik 1", code: "TEKTEK01", subject: "Teknik", level: "Gymnasiet", description: "Tekniska system, konstruktion och hållbar utveckling.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "teknik2", name: "Teknik 2", code: "TEKTEK02", subject: "Teknik", level: "Gymnasiet", description: "Fördjupning inom teknik och design.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "teknik3", name: "Teknik 3", code: "TEKTEK03", subject: "Teknik", level: "Gymnasiet", description: "Avancerad teknik och produktutveckling.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "teknik4", name: "Teknik 4", code: "TEKTEK04", subject: "Teknik", level: "Gymnasiet", description: "Specialiserad teknikkurs.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "prog1", name: "Programmering 1", code: "PRRPRR01", subject: "Programmering", level: "Gymnasiet", description: "Grundläggande programmering med Python, algoritmer och datastrukturer.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "prog2", name: "Programmering 2", code: "PRRPRR02", subject: "Programmering", level: "Gymnasiet", description: "Fördjupning i programmering och mjukvaruutveckling.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "tillampad-prog", name: "Tillämpad programmering", code: "PRRAPP01", subject: "Programmering", level: "Gymnasiet", description: "Programmering i ett tillämpat projekt.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "webbutv1", name: "Webbutveckling 1", code: "GRNWEB01", subject: "Programmering", level: "Gymnasiet", description: "Webbteknik, HTML, CSS och grundläggande JavaScript.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "webbutv2", name: "Webbutveckling 2", code: "GRNWEB02", subject: "Programmering", level: "Gymnasiet", description: "Fördjupning inom webbutveckling.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "datorteknik1", name: "Datorteknik 1", code: "DAODAT01", subject: "Teknik", level: "Gymnasiet", description: "Datorns uppbyggnad, nätverk och operativsystem.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  // Språk
  { id: "engelska5", name: "Engelska 5", code: "ENGENG05", subject: "Engelska", level: "Gymnasiet", description: "Gymnasiets första engelskakurs.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "engelska6", name: "Engelska 6", code: "ENGENG06", subject: "Engelska", level: "Gymnasiet", description: "Fortsättningskurs i engelska.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "engelska7", name: "Engelska 7", code: "ENGENG07", subject: "Engelska", level: "Gymnasiet", description: "Fördjupningskurs i engelska.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "svenska1", name: "Svenska 1", code: "SVESVE01", subject: "Svenska", level: "Gymnasiet", description: "Läs- och skrivutveckling samt retorik.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "svenska2", name: "Svenska 2", code: "SVESVE02", subject: "Svenska", level: "Gymnasiet", description: "Litteratur, språkhistoria och skrivande.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "svenska3", name: "Svenska 3", code: "SVESVE03", subject: "Svenska", level: "Gymnasiet", description: "Litteraturfördjupning och akademiskt skrivande.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  // Samhällsämnen
  { id: "samhall1a", name: "Samhällskunskap 1a", code: "SAMSAM01a", subject: "Samhällskunskap", level: "Gymnasiet", description: "Demokrati, politik och ekonomi.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "samhall1b", name: "Samhällskunskap 1b", code: "SAMSAM01b", subject: "Samhällskunskap", level: "Gymnasiet", description: "Fortsättningskurs i samhällskunskap.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "samhall2", name: "Samhällskunskap 2", code: "SAMSAM02", subject: "Samhällskunskap", level: "Gymnasiet", description: "Fördjupning i samhällsvetenskap.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "historia1a", name: "Historia 1a", code: "HISHIS01a", subject: "Historia", level: "Gymnasiet", description: "Världshistoria och historiebruk.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "historia1b", name: "Historia 1b", code: "HISHIS01b", subject: "Historia", level: "Gymnasiet", description: "Fortsättningskurs i historia.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "religion1", name: "Religionskunskap 1", code: "RELREL01", subject: "Religion", level: "Gymnasiet", description: "Världsreligioner och livsåskådningar.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "geografi1", name: "Geografi 1", code: "GEOGEO01", subject: "Geografi", level: "Gymnasiet", description: "Natur- och kulturgeografi.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "psykologi1", name: "Psykologi 1", code: "PSYPSY01", subject: "Psykologi", level: "Gymnasiet", description: "Psykologins grunder och människans utveckling.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "filosofi1", name: "Filosofi 1", code: "FILFIL01", subject: "Filosofi", level: "Gymnasiet", description: "Filosofisk argumentation och etik.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  // Högstadiet
  { id: "matte-ak7", name: "Matematik (åk 7–9)", code: "MAT", subject: "Matematik", level: "Högstadiet", description: "Högstadiematematik.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "fysik-ak7", name: "Fysik (åk 7–9)", code: "FYS", subject: "Fysik", level: "Högstadiet", description: "Högstadietfysik.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "kemi-ak7", name: "Kemi (åk 7–9)", code: "KEM", subject: "Kemi", level: "Högstadiet", description: "Högstadietkemi.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "biologi-ak7", name: "Biologi (åk 7–9)", code: "BIO", subject: "Biologi", level: "Högstadiet", description: "Högstadietbiologi.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
  { id: "teknik-ak7", name: "Teknik (åk 7–9)", code: "TEK", subject: "Teknik", level: "Högstadiet", description: "Högstadietteknik.", gradeThresholds: DEFAULT_GRADE_THRESHOLDS },
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

const SUBJECT_KEYWORDS: { [key: string]: string } = {
  matte: "Matematik",
  matematik: "Matematik",
  fysik: "Fysik",
  kemi: "Kemi",
  biologi: "Biologi",
  teknik: "Teknik",
  programmering: "Programmering",
  tillämpad: "Programmering",
  webb: "Programmering",
  data: "Teknik",
  naturkunskap: "Naturkunskap",
  engelska: "Engelska",
  svenska: "Svenska",
  samhäll: "Samhällskunskap",
  historia: "Historia",
  religion: "Religion",
  geograf: "Geografi",
  psykologi: "Psykologi",
  filosofi: "Filosofi",
};

export function deriveSubject(name: string): string {
  const lower = name.toLowerCase();
  for (const [keyword, subject] of Object.entries(SUBJECT_KEYWORDS)) {
    if (lower.includes(keyword)) return subject;
  }
  return "Övrigt";
}

export function slugifyKursId(name: string): string {
  return name
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

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

function mapBackendCourse(c: import("@/lib/api").BackendCourse): Kurs {
  return {
    id: c.id,
    name: c.name,
    code: c.code,
    subject: c.subject,
    level: c.level ?? undefined,
    description: c.description,
    gradeThresholds: c.gradeThresholds ?? { ...DEFAULT_GRADE_THRESHOLDS },
    isCustom: true,
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
      found: s.found ?? undefined,
      transcriptionConfidence: s.transcriptionConfidence ?? undefined,
      annotation: s.annotation ?? undefined,
      error: s.error ?? undefined,
      outsideAnswerKey: s.outsideAnswerKey,
      mathVerification: s.mathVerification ?? undefined,
      feedbackProvider: s.feedbackProvider ?? undefined,
    })),
    totalScore: r.totalScore,
    maxScore: r.maxScore,
    percentage: r.percentage,
    grade: r.grade ?? undefined,
    feedback: r.feedback ?? undefined,
    scannedAt: r.scannedAt,
    gradedAt: r.gradedAt ?? undefined,
    scanPages: r.scanPages ?? [],
    document: r.document ?? undefined,
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
      const [backendClasses, backendTests, backendCourses] = await Promise.all([
        api.listClasses(),
        api.listAllTests(),
        api.listCourses(),
      ]);
      const loadedClasses = backendClasses.map(mapBackendClass);
      const loadedTests = backendTests.map(mapBackendTest);
      const customCourses = backendCourses.map(mapBackendCourse);

      useStore.setState((state) => ({
        kurser: [...KURSER, ...customCourses.filter((c) => !KURSER.some((base) => base.id === c.id))],
        klasser: [
          ...loadedClasses,
          ...state.klasser.filter((current) => !loadedClasses.some((loaded) => loaded.id === current.id)),
        ],
        prov: [
          ...loadedTests,
          ...state.prov.filter((current) => !loadedTests.some((loaded) => loaded.id === current.id)),
        ],
        hydrated: true,
        loading: false,
        error: null,
      }));

      void api.listGradingResults()
        .then((backendResults) => {
          const loadedResults = backendResults.map(mapBackendResult);
          useStore.setState((state) => ({
            results: [
              ...loadedResults,
              ...state.results.filter((current) => !loadedResults.some((loaded) => loaded.id === current.id)),
            ],
          }));
        })
        .catch((error) => useStore.setState({ error: (error as Error).message }));
    } catch (error) {
      const err = error as Error;
      // Allowlist-gate: om backend returnerar 403 är användaren inte godkänd.
      // Logga ut och visa meddelande via URL-param.
      if (err.message.includes("403")) {
        try {
          const { createClient } = await import("@/lib/supabase/client");
          await createClient().auth.signOut();
        } catch { /* signOut misslyckas om sessionen redan är borta */ }
        window.location.href = "/login?error=not_allowed";
        return;
      }
      useStore.setState({ loading: false, error: err.message, hydrated: true });
    }
  },

  /** Hämtar ett enskilt resultat med scanPages från detail-endpointen.
   *  Listvyn returnerar inte scanPages — denna funktion fyller på dem vid behov
   *  (t.ex. när Workbench eller print-vyn öppnas). */
  fetchResultDetail: async (resultId: string): Promise<void> => {
    try {
      const backendResult = await api.getResult(resultId);
      const detailed = mapBackendResult(backendResult);
      useStore.setState((state) => ({
        results: state.results.map((r) =>
          r.id === resultId ? { ...r, scanPages: detailed.scanPages } : r
        ),
      }));
    } catch (error) {
      useStore.setState({ error: (error as Error).message });
    }
  },

  addKurs: (kurs: Kurs): void => {
    useStore.setState((state) => {
      if (state.kurser.some((k) => k.id === kurs.id)) return state;
      return { kurser: [...state.kurser, kurs] };
    });
  },

  createKurs: async (data: {
    name: string;
    code?: string;
    subject: string;
    level?: string;
    description?: string;
  }): Promise<Kurs> => {
    const backendCourse = await api.createCourse({
      ...data,
      code: data.code ?? "",
      description: data.description ?? "",
      gradeThresholds: { ...DEFAULT_GRADE_THRESHOLDS },
    });
    const course = mapBackendCourse(backendCourse);
    useStore.setState((state) => ({ kurser: [...state.kurser, course] }));
    return course;
  },

  deleteKurs: async (kursId: string): Promise<void> => {
    await api.deleteCourse(kursId);
    useStore.setState((state) => ({ kurser: state.kurser.filter((k) => k.id !== kursId) }));
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
    useStore.setState((state) => ({
      klasser: state.klasser.some((k) => k.id === newKlass.id)
        ? state.klasser.map((k) => (k.id === newKlass.id ? newKlass : k))
        : [...state.klasser, newKlass],
    }));
    return newKlass;
  },

  loadKlass: async (klassId: string): Promise<Klass> => {
    const klass = mapBackendClass(await api.getClass(klassId));
    useStore.setState((state) => ({
      klasser: state.klasser.some((k) => k.id === klass.id)
        ? state.klasser.map((k) => (k.id === klass.id ? klass : k))
        : [...state.klasser, klass],
    }));
    return klass;
  },

  deleteKlass: async (klassId: string): Promise<void> => {
    await api.deleteClass(klassId);
    useStore.setState((state) => {
      const testIds = new Set(state.prov.filter((p) => p.klassId === klassId).map((p) => p.id));
      return {
        klasser: state.klasser.filter((k) => k.id !== klassId),
        prov: state.prov.filter((p) => p.klassId !== klassId),
        results: state.results.filter((r) => !testIds.has(r.provId)),
      };
    });
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
          found: s.found,
          transcriptionConfidence: s.transcriptionConfidence,
          annotation: s.annotation,
          error: s.error,
          outsideAnswerKey: s.outsideAnswerKey,
          mathVerification: s.mathVerification,
          feedbackProvider: s.feedbackProvider,
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
    mathVerification: q.mathVerification,
    feedbackProvider: q.feedbackProvider,
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
    identificationMethod: b.identificationMethod as StudentResult["identificationMethod"],
    identificationConfidence: b.identificationConfidence,
    steps,
    totalScore,
    maxScore,
    percentage,
    scannedAt: now,
    gradedAt: now,
    scanPages: b.scanPages,
    sourceFiles: b.sourceFiles,
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
      identificationMethod,
    }, signal);

    onPhase?.('saving');

    const added: StudentResult[] = resp.results.map((b) =>
      mapBatchToStudentResult(b, b.studentId ?? `unknown-${b.id}`),
    );

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
