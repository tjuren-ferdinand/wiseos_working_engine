export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type Assignment = {
  id: string;
  title: string;
  subject: string | null;
  grade_level: string | null;
  problem_text: string | null;
  correct_answer: string;
  created_at: string;
};

export type ReviewStatus =
  | "auto_approved"
  | "pending_review"
  | "approved"
  | "edited"
  | "rejected";

export type Submission = {
  id: string;
  assignment_id: string;
  student_name: string;
  answer_text: string;
  student_pseudonym: string | null;
  score: number;
  ai_feedback: string | null;
  wolfram_verification: Record<string, unknown> | null;
  graded_at: string;
  ocr_confidence: number | null;
  wolfram_confidence: number | null;
  confidence_overall: number | null;
  requires_review: boolean;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  final_feedback: string | null;
  final_score: number | null;
};

export type ReviewAction = {
  action: "approve" | "edit" | "reject";
  reviewed_by?: string;
  final_feedback?: string;
  final_score?: number;
};

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export type OcrResult = { latex: string; text: string; confidence: number };
export type AnswerKeyItem = {
  question_number: string;
  final_answer: string;
  derivation_steps: string[];
};

/** Speglar backendens BatchGradingStep – matchar frontendens GradingStep i lib/store.ts. */
export type BatchGradingStep = {
  id: string;
  label: string;
  studentWork: string;
  baseAnnotation: string;
  appliedRules: string[];
  aiVerdict: "correct" | "partial" | "incorrect";
  pointsMax: number;
  pointsBase: number;
  pointsTeacher: number | null;
  status: string;
  teacherComment?: string | null;
  confidence: number;
  wolframNotes: string | null;
};

export type BatchStudentResult = {
  id: string;
  provId: string;
  studentName: string;
  scanPages: string[];
  steps: BatchGradingStep[];
};

export type BatchGradeResponse = {
  provId: string;
  results: BatchStudentResult[];
  activeRules: string[];
  totalStudents: number;
  totalSteps: number;
  integrations: Record<string, boolean | string>;
};

export type BatchGradeRequest = {
  provId: string;
  classGradingParameters: string;
  testSpecificParameters: string;
  answerKey: AnswerKeyItem[];
  files: File[];
};

export const api = {
  listAssignments: () => jsonFetch<Assignment[]>("/api/v1/assignments"),
  getAssignment: (id: string) => jsonFetch<Assignment>(`/api/v1/assignments/${id}`),
  createAssignment: (data: Omit<Assignment, "id" | "created_at">) =>
    jsonFetch<Assignment>("/api/v1/assignments", { method: "POST", body: JSON.stringify(data) }),
  listResults: (id: string) => jsonFetch<Submission[]>(`/api/v1/assignments/${id}/results`),
  grade: (data: { assignment_id: string; student_name: string; answer_text: string; ocr_confidence?: number | null }) =>
    jsonFetch<{ submission: Submission; wolfram: any; feedback: string }>(
      "/api/v1/submissions/grade",
      { method: "POST", body: JSON.stringify(data) },
    ),
  listPending: () => jsonFetch<Submission[]>("/api/v1/submissions/pending"),
  review: (submissionId: string, action: ReviewAction) =>
    jsonFetch<Submission>(`/api/v1/submissions/${submissionId}/review`, {
      method: "POST",
      body: JSON.stringify(action),
    }),
  ocrUpload: async (file: File): Promise<OcrResult> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/api/v1/ocr/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`OCR ${res.status}: ${await res.text()}`);
    return res.json();
  },
  answerKeyUpload: async (file: File): Promise<AnswerKeyItem[]> => {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_URL}/api/v1/ocr/answer-key/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`Facit ${res.status}: ${await res.text()}`);
    return res.json();
  },
  answerKeyGenerate: async (description: string, questionCount = 4): Promise<AnswerKeyItem[]> => {
    const fd = new FormData();
    fd.append("description", description);
    fd.append("question_count", String(questionCount));
    const res = await fetch(`${API_URL}/api/v1/ocr/answer-key/generate`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(`Facit ${res.status}: ${await res.text()}`);
    return res.json();
  },
  batchGrade: async (req: BatchGradeRequest, signal?: AbortSignal): Promise<BatchGradeResponse> => {
    const fd = new FormData();
    fd.append("prov_id", req.provId);
    fd.append("class_grading_parameters", req.classGradingParameters);
    fd.append("test_specific_parameters", req.testSpecificParameters);
    fd.append("answer_key_json", JSON.stringify(req.answerKey));
    for (const f of req.files) fd.append("files", f, f.name);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const res = await fetch(`${API_URL}/api/v1/batch/grade`, {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`Batch ${res.status}: ${await res.text()}`);
      return res.json();
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        throw new Error("Rättningen tog längre än fem minuter. Kontrollera att backend körs och försök igen.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
  },
};
