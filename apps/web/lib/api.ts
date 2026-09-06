import { createClient } from "@/lib/supabase/client";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Hämtar Supabase-sessionens access token (JWT) om användaren är inloggad. */
async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    // Ingen Supabase-session tillgänglig (t.ex. server-rendering) — skicka utan token.
    return {};
  }
}



async function jsonFetch<T>(path: string, init?: RequestInit, fallbackKey?: string): Promise<T> {
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...authHeader, ...(init?.headers || {}) },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  } catch (err) {
    throw err;
  }
}

export type OcrResult = { latex: string; text: string; confidence: number; provider: string; status: "completed" | "degraded" };
export type AnswerKeyItem = {
  question_number: string;
  question_text: string;
  final_answer: string;
  acceptable_answers?: string[];
  derivation_steps: string[];
  important_concepts?: string[];
  reasoning_requirements?: string[];
  mathematical_verification?: boolean | null;
  max_points: number;
};

// ---------------------------------------------------------------------------
// KANONISKT RESULTATSCHEMA
// Detta speglar exakt backendens app/schemas.py. Frontenden härleder INTE egna
// tolkningar av resultatet och hittar aldrig på innehåll som backend inte skickat.
// ---------------------------------------------------------------------------

export type GradingStatus = "correct" | "partial" | "incorrect" | "needs_review";

export type SourceRegion = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Strukturerad AI-annotering. Varje punkt refererar till elevens faktiska arbete. */
export type Annotation = {
  summary: string;
  evidence: string[];
  issues: string[];
  suggestions: string[];
};

export type Assessment = {
  status: GradingStatus;
  points: number;
  maxPoints: number;
  confidence: number;
};

export type MathVerification = {
  provider: string;
  status: "not_applicable" | "verified" | "not_equivalent" | "degraded" | "unavailable" | "failed";
  isEquivalent: boolean | null;
  confidence: number;
  message: string;
};

export type QuestionResult = {
  questionNumber: string;
  /** false = uppgiften finns inte i dokumentet. Oläslig handstil ger true + låg confidence. */
  found: boolean;
  /** false = uppgiften hittades i bilden men saknas i facit. */
  inAnswerKey: boolean;
  questionText: string;
  studentWork: string;
  transcriptionConfidence: number;
  correctAnswer: string;
  assessment: Assessment;
  feedback: string;
  annotation: Annotation;
  sourceRegions: SourceRegion[];
  mathVerification: MathVerification;
  feedbackProvider: string;
  /** Satt när ett tekniskt fel hindrade bedömning. */
  error: string | null;
  pointsTeacher: number | null;
  teacherComment: string | null;
  reviewStatus: string;
};

export type DocumentMeta = {
  pageCount: number;
  model: string;
  latencyMs: number;
  attempts: number;
  questionsExpected: number;
  questionsFound: number;
  needsReviewCount: number;
  error: string | null;
};

export type StudentDocumentResult = {
  id: string;
  provId: string;
  studentId: string | null;
  studentName: string;
  identificationMethod: string;
  identificationConfidence: number;
  scanPages: string[];
  document: DocumentMeta;
  questions: QuestionResult[];
};

export type BatchGradeResponse = {
  provId: string;
  results: StudentDocumentResult[];
  activeRules: string[];
  totalStudents: number;
  totalQuestions: number;
  integrations: Record<string, boolean | string>;
};

export type BatchGradeRequest = {
  provId: string;
  classGradingParameters: string;
  testSpecificParameters: string;
  answerKey: AnswerKeyItem[];
  files: File[];
  identificationMethod?: 'name_field' | 'qr_code' | 'barcode' | 'student_id';
};

// ============================================================================
// V2 — Kurs → Klass → Test(Prov) → GradingResult (backend-persisterat)
// ============================================================================

export type BackendStudent = { id: string; name: string; identifier: string | null };

export type BackendGradingParams = {
  allowPartialCredit: boolean;
  unitErrorPenalty: number;
  roundingTolerance: number;
  requireWorkShown: boolean;
  significantFigures: boolean;
  customRules: string[];
};

export type BackendGradeThresholds = { A: number; B: number; C: number; D: number; E: number; F: number };

export type BackendClass = {
  id: string;
  name: string;
  kursId: string;
  students: BackendStudent[];
  gradingParams: BackendGradingParams | null;
  gradeThresholds: BackendGradeThresholds | null;
  createdAt: string;
};

export type BackendQuestion = { id: string; number: string; maxPoints: number };

export type BackendTest = {
  id: string;
  klassId: string;
  title: string;
  date: string | null;
  maxPoints: number;
  facitMode: string;
  facit: string | null;
  customParams: string | null;
  questions: BackendQuestion[];
  status: string;
  createdAt: string;
};

export type BackendGradingStep = {
  id: string;
  questionId?: string | null;
  label: string;
  questionText?: string | null;
  maxPoints: number;
  earnedPoints: number;
  status: string;
  feedback?: string | null;
  studentWork?: string | null;
  correctAnswer?: string | null;
  found?: boolean | null;
  transcriptionConfidence?: number | null;
  annotation?: Annotation | null;
  error?: string | null;
  outsideAnswerKey?: boolean;
  sourceRegions?: SourceRegion[];
  mathVerification?: MathVerification | null;
  feedbackProvider?: string | null;
};

export type BackendGradingResult = {
  id: string;
  provId: string;
  studentId: string | null;
  studentName: string;
  identificationMethod: string;
  identificationConfidence: number;
  steps: BackendGradingStep[];
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: string | null;
  feedback: string | null;
  scannedAt: string;
  gradedAt: string | null;
  scanPages: string[];
  document: DocumentMeta | null;
};

export type ClaudeAnalyzeResult = {
  feedback: string;
  isCorrect: boolean;
  confidence: number;
  /** Ärlig källa: 'gemini' | 'groq' | 'anthropic' | 'mock' (mock = alla AI-providers misslyckades). */
  provider: string;
};

export const api = {
  // --- Classes / students ---
  listClasses: () => jsonFetch<BackendClass[]>("/api/v1/classes", undefined, "classes"),
  getClass: async (id: string) => {
    const data = await jsonFetch<BackendClass | BackendClass[]>(`/api/v1/classes/${id}`, undefined, "classes");
    if (Array.isArray(data)) {
      const found = data.find((c) => c.id === id);
      if (!found) throw new Error("Class not found in demo data");
      return found;
    }
    return data;
  },
  createClass: (data: {
    name: string;
    kursId: string;
    students?: { name: string; identifier?: string }[];
    gradingParams?: BackendGradingParams;
    gradeThresholds?: BackendGradeThresholds;
  }) => jsonFetch<BackendClass>("/api/v1/classes", { method: "POST", body: JSON.stringify(data) }),
  addStudent: (classId: string, data: { name: string; identifier?: string }) =>
    jsonFetch<BackendStudent>(`/api/v1/classes/${classId}/students`, { method: "POST", body: JSON.stringify(data) }),
  updateClass: (
    classId: string,
    data: { name?: string; gradingParams?: BackendGradingParams; gradeThresholds?: BackendGradeThresholds },
  ) => jsonFetch<BackendClass>(`/api/v1/classes/${classId}`, { method: "PATCH", body: JSON.stringify(data) }),
  // --- Tests / Prov ---
  listTests: (classId: string) =>
    jsonFetch<BackendTest[]>(`/api/v1/classes/${classId}/tests`, undefined, "tests").then((arr) =>
      arr.filter((t) => t.klassId === classId),
    ),
  createTest: (
    classId: string,
    data: {
      title: string;
      date?: string;
      maxPoints?: number;
      facitMode?: string;
      facit?: string;
      customParams?: string;
      questions?: BackendQuestion[];
      status?: string;
    },
  ) => jsonFetch<BackendTest>(`/api/v1/classes/${classId}/tests`, { method: "POST", body: JSON.stringify(data) }),
  getTest: async (testId: string) => {
    const data = await jsonFetch<BackendTest | BackendTest[]>(`/api/v1/classes/tests/${testId}`, undefined, "tests");
    if (Array.isArray(data)) {
      const found = data.find((t) => t.id === testId);
      if (!found) throw new Error("Test not found in demo data");
      return found;
    }
    return data;
  },
  updateTest: (
    testId: string,
    data: {
      title?: string;
      date?: string;
      maxPoints?: number;
      facitMode?: string;
      facit?: string;
      customParams?: string;
      questions?: BackendQuestion[];
      status?: string;
    },
  ) => jsonFetch<BackendTest>(`/api/v1/classes/tests/${testId}`, { method: "PATCH", body: JSON.stringify(data) }),
  // --- Grading results (Test → GradingResult) ---
  listGradingResults: (testId?: string) =>
    jsonFetch<BackendGradingResult[]>(`/api/v1/results${testId ? `?testId=${encodeURIComponent(testId)}` : ""}`, undefined, "results").then(
      (arr) => (testId ? arr.filter((r) => r.provId === testId) : arr),
    ),
  createResult: (data: {
    testId: string;
    studentName: string;
    studentId?: string;
    identificationMethod?: string;
    identificationConfidence?: number;
    steps: BackendGradingStep[];
    totalScore: number;
    maxScore: number;
    percentage: number;
    grade?: string;
    feedback?: string;
  }) => jsonFetch<BackendGradingResult>("/api/v1/results", { method: "POST", body: JSON.stringify(data) }),
  updateResult: (
    resultId: string,
    data: {
      steps?: BackendGradingStep[];
      totalScore?: number;
      maxScore?: number;
      percentage?: number;
      grade?: string;
      feedback?: string;
    },
  ) => jsonFetch<BackendGradingResult>(`/api/v1/results/${resultId}`, { method: "PATCH", body: JSON.stringify(data) }),
  // --- AI (provider-ärlig, se ClaudeAnalyzeResult.provider) ---
  claudeAnalyze: (data: { problem: string; studentAnswer: string; correctAnswer: string; context?: string }) =>
    jsonFetch<ClaudeAnalyzeResult>("/api/v1/claude/analyze", { method: "POST", body: JSON.stringify(data) }),

  ocrUpload: async (file: File): Promise<OcrResult> => {
    const fd = new FormData();
    fd.append("file", file);
    const authHeader = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/v1/ocr/upload`, { method: "POST", body: fd, headers: authHeader });
    if (!res.ok) throw new Error(`OCR ${res.status}: ${await res.text()}`);
    return res.json();
  },
  answerKeyUpload: async (file: File): Promise<AnswerKeyItem[]> => {
    const fd = new FormData();
    fd.append("file", file);
    const authHeader = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/v1/ocr/answer-key/upload`, { method: "POST", body: fd, headers: authHeader });
    if (!res.ok) throw new Error(`Facit ${res.status}: ${await res.text()}`);
    return res.json();
  },
  answerKeyGenerate: async (description: string, questionCount = 4): Promise<AnswerKeyItem[]> => {
    const fd = new FormData();
    fd.append("description", description);
    fd.append("question_count", String(questionCount));
    const authHeader = await getAuthHeader();
    const res = await fetch(`${API_URL}/api/v1/ocr/answer-key/generate`, { method: "POST", body: fd, headers: authHeader });
    if (!res.ok) throw new Error(`Facit ${res.status}: ${await res.text()}`);
    return res.json();
  },
  batchGrade: async (req: BatchGradeRequest, signal?: AbortSignal): Promise<BatchGradeResponse> => {
    const fd = new FormData();
    fd.append("prov_id", req.provId);
    fd.append("class_grading_parameters", req.classGradingParameters);
    fd.append("test_specific_parameters", req.testSpecificParameters);
    fd.append("answer_key_json", JSON.stringify(req.answerKey));
    if (req.identificationMethod) fd.append("identification_method", req.identificationMethod);
    for (const f of req.files) fd.append("files", f, f.name);

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 300_000);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(`${API_URL}/api/v1/batch/grade`, {
        method: "POST",
        body: fd,
        headers: authHeader,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Batch ${res.status}: ${await res.text()}`);
      return res.json();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        if (timedOut) {
          throw new Error("Rättningen överskred fem minuters tidsgräns. Jobbets sparade status kan kontrolleras från provsidan.");
        }
        throw new DOMException("Rättningen avbröts av användaren.", "AbortError");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  },
};
