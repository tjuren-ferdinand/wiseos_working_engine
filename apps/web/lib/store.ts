import { create } from "zustand";
import { api, type AnswerKeyItem, type BatchStudentResult } from "@/lib/api";

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
  questionId: string;
  label: string;
  maxPoints: number;
  earnedPoints: number;
  status: "correct" | "partial" | "incorrect" | "pending";
  feedback?: string;
  studentWork?: string;
  correctAnswer?: string;
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
// DEMO DATA - Komplett STEM-lärarportfölj
// ============================================================================

const DEMO_KURSER: Kurs[] = [
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

// 25 elever i NA22B för Fysik 2
const NA22B_FYSIK2_STUDENTS: Student[] = [
  { id: "f2s1", name: "Elin Karlsson", identifier: "NA22B-001" },
  { id: "f2s2", name: "Oscar Lindberg", identifier: "NA22B-002" },
  { id: "f2s3", name: "Wilma Ström", identifier: "NA22B-003" },
  { id: "f2s4", name: "Hugo Bergman", identifier: "NA22B-004" },
  { id: "f2s5", name: "Alma Johansson", identifier: "NA22B-005" },
  { id: "f2s6", name: "Liam Eriksson", identifier: "NA22B-006" },
  { id: "f2s7", name: "Ella Andersson", identifier: "NA22B-007" },
  { id: "f2s8", name: "William Larsson", identifier: "NA22B-008" },
  { id: "f2s9", name: "Maja Pettersson", identifier: "NA22B-009" },
  { id: "f2s10", name: "Lucas Nilsson", identifier: "NA22B-010" },
  { id: "f2s11", name: "Ebba Svensson", identifier: "NA22B-011" },
  { id: "f2s12", name: "Oliver Gustafsson", identifier: "NA22B-012" },
  { id: "f2s13", name: "Alice Persson", identifier: "NA22B-013" },
  { id: "f2s14", name: "Noah Olsson", identifier: "NA22B-014" },
  { id: "f2s15", name: "Saga Lindqvist", identifier: "NA22B-015" },
  { id: "f2s16", name: "Elias Magnusson", identifier: "NA22B-016" },
  { id: "f2s17", name: "Vera Axelsson", identifier: "NA22B-017" },
  { id: "f2s18", name: "Filip Bergström", identifier: "NA22B-018" },
  { id: "f2s19", name: "Stella Lindgren", identifier: "NA22B-019" },
  { id: "f2s20", name: "Leo Sundberg", identifier: "NA22B-020" },
  { id: "f2s21", name: "Selma Holmberg", identifier: "NA22B-021" },
  { id: "f2s22", name: "Theo Nyström", identifier: "NA22B-022" },
  { id: "f2s23", name: "Astrid Sandberg", identifier: "NA22B-023" },
  { id: "f2s24", name: "Axel Forsberg", identifier: "NA22B-024" },
  { id: "f2s25", name: "Molly Engström", identifier: "NA22B-025" },
];

const DEMO_KLASSER: Klass[] = [
  // FYSIK 2 - Huvudkurs
  {
    id: "na22b-fysik2",
    name: "NA22B",
    kursId: "fysik2",
    students: NA22B_FYSIK2_STUDENTS,
    gradingParams: {
      ...DEFAULT_GRADING_PARAMS,
      customRules: [
        "Acceptera alternativa lösningsmetoder",
        "Kräv enheter i slutsvar",
        "Delpoäng för korrekt ansats även vid räknefel",
      ],
    },
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
  {
    id: "te22a-fysik2",
    name: "TE22A",
    kursId: "fysik2",
    students: [
      { id: "te1", name: "Viktor Holm", identifier: "TE22A-001" },
      { id: "te2", name: "Ida Lund", identifier: "TE22A-002" },
      { id: "te3", name: "Emil Sjöberg", identifier: "TE22A-003" },
      { id: "te4", name: "Tilda Fransson", identifier: "TE22A-004" },
      { id: "te5", name: "Arvid Nordin", identifier: "TE22A-005" },
      { id: "te6", name: "Liv Hedlund", identifier: "TE22A-006" },
      { id: "te7", name: "Isak Blom", identifier: "TE22A-007" },
      { id: "te8", name: "Nora Ek", identifier: "TE22A-008" },
      { id: "te9", name: "Albin Strand", identifier: "TE22A-009" },
      { id: "te10", name: "Tuva Dahl", identifier: "TE22A-010" },
      { id: "te11", name: "Melvin Åberg", identifier: "TE22A-011" },
      { id: "te12", name: "Signe Wallin", identifier: "TE22A-012" },
    ],
    gradingParams: DEFAULT_GRADING_PARAMS,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
  // MATEMATIK 4
  {
    id: "na22b-matte4",
    name: "NA22B",
    kursId: "matte4",
    students: NA22B_FYSIK2_STUDENTS.slice(0, 20), // Samma elever, 20 st läser matte 4
    gradingParams: {
      ...DEFAULT_GRADING_PARAMS,
      customRules: [
        "Fullständig lösning krävs för full poäng",
        "Acceptera både algebraisk och grafisk lösning",
      ],
    },
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
  {
    id: "te22a-matte4",
    name: "TE22A",
    kursId: "matte4",
    students: [
      { id: "m1", name: "Agnes Lindström", identifier: "TE22A-M01" },
      { id: "m2", name: "Casper Öberg", identifier: "TE22A-M02" },
      { id: "m3", name: "Hedda Nyberg", identifier: "TE22A-M03" },
      { id: "m4", name: "Viggo Ekström", identifier: "TE22A-M04" },
      { id: "m5", name: "Tyra Hellström", identifier: "TE22A-M05" },
      { id: "m6", name: "Sixten Åkesson", identifier: "TE22A-M06" },
      { id: "m7", name: "Edith Berglund", identifier: "TE22A-M07" },
      { id: "m8", name: "Melker Wikström", identifier: "TE22A-M08" },
    ],
    gradingParams: DEFAULT_GRADING_PARAMS,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
  // KEMI 2
  {
    id: "na22b-kemi2",
    name: "NA22B",
    kursId: "kemi2",
    students: NA22B_FYSIK2_STUDENTS.slice(0, 18),
    gradingParams: {
      ...DEFAULT_GRADING_PARAMS,
      customRules: [
        "Reaktionsformler måste vara balanserade",
        "Strukturformler accepteras istället för namn",
      ],
    },
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
  // PROGRAMMERING 1
  {
    id: "te22a-prog1",
    name: "TE22A",
    kursId: "prog1",
    students: [
      { id: "p1", name: "Milo Sandström", identifier: "TE22A-P01" },
      { id: "p2", name: "Juni Björk", identifier: "TE22A-P02" },
      { id: "p3", name: "Neo Lundqvist", identifier: "TE22A-P03" },
      { id: "p4", name: "Iris Månsson", identifier: "TE22A-P04" },
      { id: "p5", name: "Dante Norberg", identifier: "TE22A-P05" },
      { id: "p6", name: "Ronja Eliasson", identifier: "TE22A-P06" },
      { id: "p7", name: "Alve Sjögren", identifier: "TE22A-P07" },
      { id: "p8", name: "Tove Lindholm", identifier: "TE22A-P08" },
      { id: "p9", name: "Vidar Hermansson", identifier: "TE22A-P09" },
      { id: "p10", name: "Freja Carlsson", identifier: "TE22A-P10" },
      { id: "p11", name: "Olle Jansson", identifier: "TE22A-P11" },
      { id: "p12", name: "Lova Bengtsson", identifier: "TE22A-P12" },
      { id: "p13", name: "Ludvig Eklund", identifier: "TE22A-P13" },
      { id: "p14", name: "Hilma Löfgren", identifier: "TE22A-P14" },
    ],
    gradingParams: {
      ...DEFAULT_GRADING_PARAMS,
      customRules: [
        "Koden måste vara körbar",
        "Kommentarer ger bonuspoäng",
        "Effektiv algoritm premieras",
      ],
    },
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
  // TEKNIK 1
  {
    id: "te22a-teknik1",
    name: "TE22A",
    kursId: "teknik1",
    students: [
      { id: "t1", name: "Sigge Abrahamsson", identifier: "TE22A-T01" },
      { id: "t2", name: "Elise Davidsson", identifier: "TE22A-T02" },
      { id: "t3", name: "Malte Isaksson", identifier: "TE22A-T03" },
      { id: "t4", name: "Thea Mattsson", identifier: "TE22A-T04" },
      { id: "t5", name: "Love Hansson", identifier: "TE22A-T05" },
      { id: "t6", name: "Elvira Jonsson", identifier: "TE22A-T06" },
      { id: "t7", name: "Edvin Olofsson", identifier: "TE22A-T07" },
      { id: "t8", name: "Cornelia Persson", identifier: "TE22A-T08" },
      { id: "t9", name: "Alfred Karlsson", identifier: "TE22A-T09" },
      { id: "t10", name: "Felicia Lindberg", identifier: "TE22A-T10" },
    ],
    gradingParams: DEFAULT_GRADING_PARAMS,
    gradeThresholds: DEFAULT_GRADE_THRESHOLDS,
  },
];

const DEMO_PROV: Prov[] = [
  // =========================================================================
  // FYSIK 2 - NA22B - Huvudprovet
  // =========================================================================
  {
    id: "fysik2-prov1",
    klassId: "na22b-fysik2",
    title: "Mekanik, svängningar och vågrörelse",
    date: "2024-06-05",
    maxPoints: 48,
    facitMode: "uploaded",
    questions: [
      { id: "f2q1", number: "1", maxPoints: 4 },
      { id: "f2q2", number: "2", maxPoints: 5 },
      { id: "f2q3", number: "3", maxPoints: 4 },
      { id: "f2q4", number: "4", maxPoints: 4 },
      { id: "f2q5", number: "5", maxPoints: 4 },
      { id: "f2q6", number: "6", maxPoints: 3 },
      { id: "f2q7", number: "7", maxPoints: 4 },
      { id: "f2q8", number: "8", maxPoints: 4 },
      { id: "f2q9", number: "9", maxPoints: 5 },
      { id: "f2q10", number: "10", maxPoints: 4 },
      { id: "f2q11", number: "11", maxPoints: 4 },
      { id: "f2q12", number: "12", maxPoints: 3 },
    ],
    status: "published",
    createdAt: "2024-06-05T08:00:00Z",
  },
  // =========================================================================
  // MATEMATIK 4 - NA22B
  // =========================================================================
  {
    id: "matte4-prov1",
    klassId: "na22b-matte4",
    title: "Komplexa tal och polynomekvationer",
    date: "2024-05-28",
    maxPoints: 40,
    facitMode: "uploaded",
    questions: [
      { id: "m4q1", number: "1", maxPoints: 6 },
      { id: "m4q2", number: "2", maxPoints: 8 },
      { id: "m4q3", number: "3", maxPoints: 6 },
      { id: "m4q4", number: "4", maxPoints: 8 },
      { id: "m4q5", number: "5", maxPoints: 6 },
      { id: "m4q6", number: "6", maxPoints: 6 },
    ],
    status: "published",
    createdAt: "2024-05-28T08:00:00Z",
  },
  // =========================================================================
  // KEMI 2 - NA22B
  // =========================================================================
  {
    id: "kemi2-prov1",
    klassId: "na22b-kemi2",
    title: "Organisk kemi och reaktionsmekanismer",
    date: "2024-05-15",
    maxPoints: 36,
    facitMode: "uploaded",
    questions: [
      { id: "k2q1", number: "1", maxPoints: 6 },
      { id: "k2q2", number: "2", maxPoints: 8 },
      { id: "k2q3", number: "3", maxPoints: 6 },
      { id: "k2q4", number: "4", maxPoints: 8 },
      { id: "k2q5", number: "5", maxPoints: 8 },
    ],
    status: "published",
    createdAt: "2024-05-15T08:00:00Z",
  },
  // =========================================================================
  // PROGRAMMERING 1 - TE22A
  // =========================================================================
  {
    id: "prog1-prov1",
    klassId: "te22a-prog1",
    title: "Algoritmer och datastrukturer",
    date: "2024-05-22",
    maxPoints: 30,
    facitMode: "uploaded",
    questions: [
      { id: "p1q1", number: "1", maxPoints: 5 },
      { id: "p1q2", number: "2", maxPoints: 8 },
      { id: "p1q3", number: "3", maxPoints: 7 },
      { id: "p1q4", number: "4", maxPoints: 10 },
    ],
    status: "published",
    createdAt: "2024-05-22T08:00:00Z",
  },
  // =========================================================================
  // TEKNIK 1 - TE22A
  // =========================================================================
  {
    id: "teknik1-prov1",
    klassId: "te22a-teknik1",
    title: "Tekniska system och hållbarhet",
    date: "2024-05-10",
    maxPoints: 32,
    facitMode: "uploaded",
    questions: [
      { id: "t1q1", number: "1", maxPoints: 6 },
      { id: "t1q2", number: "2", maxPoints: 8 },
      { id: "t1q3", number: "3", maxPoints: 8 },
      { id: "t1q4", number: "4", maxPoints: 10 },
    ],
    status: "published",
    createdAt: "2024-05-10T08:00:00Z",
  },
];

const DEMO_RESULTS: StudentResult[] = [
  {
    id: "r1",
    provId: "prov1",
    studentId: "s1",
    studentName: "Anna Andersson",
    identificationMethod: "name_field",
    identificationConfidence: 0.95,
    steps: [
      { id: "st1", questionId: "q1", label: "1a", maxPoints: 2, earnedPoints: 2, status: "correct", feedback: "Korrekt!" },
      { id: "st2", questionId: "q1", label: "1b", maxPoints: 3, earnedPoints: 2, status: "partial", feedback: "Saknar enhet" },
      { id: "st3", questionId: "q2", label: "2", maxPoints: 5, earnedPoints: 5, status: "correct", feedback: "Perfekt!" },
      { id: "st4", questionId: "q3", label: "3", maxPoints: 5, earnedPoints: 3, status: "partial", feedback: "Rätt metod, fel beräkning" },
      { id: "st5", questionId: "q4", label: "4", maxPoints: 5, earnedPoints: 5, status: "correct", feedback: "Bra!" },
    ],
    totalScore: 17,
    maxScore: 20,
    percentage: 85,
    grade: "B",
    scannedAt: "2024-03-15T10:00:00Z",
    gradedAt: "2024-03-15T10:05:00Z",
  },
  {
    id: "r2",
    provId: "prov1",
    studentId: "s2",
    studentName: "Erik Eriksson",
    identificationMethod: "name_field",
    identificationConfidence: 0.92,
    steps: [
      { id: "st6", questionId: "q1", label: "1a", maxPoints: 2, earnedPoints: 2, status: "correct" },
      { id: "st7", questionId: "q1", label: "1b", maxPoints: 3, earnedPoints: 3, status: "correct" },
      { id: "st8", questionId: "q2", label: "2", maxPoints: 5, earnedPoints: 4, status: "partial" },
      { id: "st9", questionId: "q3", label: "3", maxPoints: 5, earnedPoints: 5, status: "correct" },
      { id: "st10", questionId: "q4", label: "4", maxPoints: 5, earnedPoints: 5, status: "correct" },
    ],
    totalScore: 19,
    maxScore: 20,
    percentage: 95,
    grade: "A",
    scannedAt: "2024-03-15T10:01:00Z",
    gradedAt: "2024-03-15T10:06:00Z",
  },
  {
    id: "r3",
    provId: "prov1",
    studentId: "s3",
    studentName: "Maria Johansson",
    identificationMethod: "name_field",
    identificationConfidence: 0.88,
    steps: [
      { id: "st11", questionId: "q1", label: "1a", maxPoints: 2, earnedPoints: 1, status: "partial" },
      { id: "st12", questionId: "q1", label: "1b", maxPoints: 3, earnedPoints: 0, status: "incorrect" },
      { id: "st13", questionId: "q2", label: "2", maxPoints: 5, earnedPoints: 3, status: "partial" },
      { id: "st14", questionId: "q3", label: "3", maxPoints: 5, earnedPoints: 2, status: "partial" },
      { id: "st15", questionId: "q4", label: "4", maxPoints: 5, earnedPoints: 4, status: "partial" },
    ],
    totalScore: 10,
    maxScore: 20,
    percentage: 50,
    grade: "D",
    scannedAt: "2024-03-15T10:02:00Z",
    gradedAt: "2024-03-15T10:07:00Z",
  },
  {
    id: "r4",
    provId: "prov1",
    studentId: "s4",
    studentName: "Johan Svensson",
    identificationMethod: "name_field",
    identificationConfidence: 0.91,
    steps: [
      { id: "st16", questionId: "q1", label: "1a", maxPoints: 2, earnedPoints: 2, status: "correct" },
      { id: "st17", questionId: "q1", label: "1b", maxPoints: 3, earnedPoints: 3, status: "correct" },
      { id: "st18", questionId: "q2", label: "2", maxPoints: 5, earnedPoints: 5, status: "correct" },
      { id: "st19", questionId: "q3", label: "3", maxPoints: 5, earnedPoints: 4, status: "partial" },
      { id: "st20", questionId: "q4", label: "4", maxPoints: 5, earnedPoints: 4, status: "partial" },
    ],
    totalScore: 18,
    maxScore: 20,
    percentage: 90,
    grade: "A",
    scannedAt: "2024-03-15T10:03:00Z",
    gradedAt: "2024-03-15T10:08:00Z",
  },
  {
    id: "r5",
    provId: "prov1",
    studentId: "s5",
    studentName: "Lisa Nilsson",
    identificationMethod: "name_field",
    identificationConfidence: 0.96,
    steps: [
      { id: "st21", questionId: "q1", label: "1a", maxPoints: 2, earnedPoints: 2, status: "correct" },
      { id: "st22", questionId: "q1", label: "1b", maxPoints: 3, earnedPoints: 2, status: "partial" },
      { id: "st23", questionId: "q2", label: "2", maxPoints: 5, earnedPoints: 4, status: "partial" },
      { id: "st24", questionId: "q3", label: "3", maxPoints: 5, earnedPoints: 5, status: "correct" },
      { id: "st25", questionId: "q4", label: "4", maxPoints: 5, earnedPoints: 3, status: "partial" },
    ],
    totalScore: 16,
    maxScore: 20,
    percentage: 80,
    grade: "B",
    scannedAt: "2024-03-15T10:04:00Z",
    gradedAt: "2024-03-15T10:09:00Z",
  },
  // Prov 2 - Rörelseprov results
  {
    id: "r6",
    provId: "prov2",
    studentId: "s1",
    studentName: "Anna Andersson",
    identificationMethod: "qr_code",
    identificationConfidence: 0.99,
    steps: [
      {
        id: "st26",
        questionId: "q5",
        label: "1",
        maxPoints: 8,
        earnedPoints: 7,
        status: "partial",
        studentWork:
          "v = 20 m/s, a = (20 - 0) / 8 s = 2,5 m/s^2. Bilen hinner ungefär 80 m enligt s = 0,5·a·t^2.",
        feedback:
          "Claude: Du använder v = a·t korrekt och resonerar rätt kring sträckan. Wolfram bekräftar beräkningen, men i facit används 10 s vilket ger a = 2,0 m/s^2. Därför blir det delpoäng.",
      },
      {
        id: "st27",
        questionId: "q6",
        label: "2",
        maxPoints: 8,
        earnedPoints: 8,
        status: "correct",
        studentWork:
          "s(t) = 3,0 t^2 + 2,0 t. Jag visar att v(t) = 6,0 t + 2,0 och sätter in t = 4 s för att få sträckan.",
        feedback:
          "Claude: Lösningen är komplett – du deriverar positionsfunktionen korrekt och använder både s(t) och v(t) på ett fysikaliskt rimligt sätt. Wolfram får samma värden.",
      },
      {
        id: "st28",
        questionId: "q7",
        label: "3",
        maxPoints: 9,
        earnedPoints: 8,
        status: "partial",
        studentWork:
          "Från grafen läser jag ut att cyklisten står still mellan 10–12 s och har högst fart runt 5 s. Jag uppskattar medelhastigheten till ca 4 m/s.",
        feedback:
          "Claude: Din tolkning av stillastående intervall och topphastighet är helt korrekt. Medelhastigheten blir dock något för hög jämfört med den exakta integralen under s–t-grafen, så du tappar 1 poäng.",
      },
      {
        id: "st41",
        questionId: "q11",
        label: "4",
        maxPoints: 3,
        earnedPoints: 2,
        status: "partial",
        studentWork:
          "Jag uppskattar bromssträckan genom att förlänga v–t-grafen och antar att bilen har samma retardation hela tiden.",
        feedback:
          "Claude: Bra idé att använda samma acceleration i en förlängd situation. Du underskattar dock bromssträckan något jämfört med en exakt beräkning, därför 1 poäng avdrag.",
      },
      {
        id: "st42",
        questionId: "q12",
        label: "5",
        maxPoints: 2,
        earnedPoints: 2,
        status: "correct",
        studentWork:
          "Jag skriver att modellen inte tar hänsyn till friktion, reaktionstid eller lutning på vägen.",
        feedback:
          "Claude: Mycket bra resonemang kring begränsningar i modellen. Du nämner flera relevanta faktorer som saknas, full poäng.",
      },
    ],
    totalScore: 27,
    maxScore: 30,
    percentage: 90,
    grade: "A",
    scannedAt: "2024-04-10T10:00:00Z",
    gradedAt: "2024-04-10T10:10:00Z",
  },
  {
    id: "r7",
    provId: "prov2",
    studentId: "s2",
    studentName: "Erik Eriksson",
    identificationMethod: "qr_code",
    identificationConfidence: 0.98,
    steps: [
      {
        id: "st29",
        questionId: "q5",
        label: "1",
        maxPoints: 8,
        earnedPoints: 8,
        status: "correct",
        studentWork:
          "a = Δv / Δt = (20 m/s − 0) / 10 s = 2,0 m/s^2. Sträckan blir s = 0,5 · 2,0 · 10^2 = 100 m.",
        feedback:
          "Claude: Exemplariskt lösning med tydliga mellanled och enheter. Wolfram ger samma resultat och alla klassregler uppfylls.",
      },
      {
        id: "st30",
        questionId: "q6",
        label: "2",
        maxPoints: 8,
        earnedPoints: 7,
        status: "partial",
        studentWork:
          "Jag använder s(t) = 3,0 t^2 + 2,0 t men avrundar svaret till 30 m istället för 32 m efter 4 s.",
        feedback:
          "Claude: Metoden är helt rätt – du sätter in i s(t) och får ett rimligt svar. Enligt klassens regler för avrundning tappar du dock 1 poäng eftersom du avrundar för grovt.",
      },
      {
        id: "st31",
        questionId: "q7",
        label: "3",
        maxPoints: 9,
        earnedPoints: 9,
        status: "correct",
        studentWork:
          "Jag beskriver hur medelhastigheten fås från lutningen på sekantlinjen och hur man ser accelerationens tecken i grafens krökning.",
        feedback:
          "Claude: Mycket stark kvalitativ analys av s–t-grafen. Du kopplar korrekt ihop lutning, medelhastighet och acceleration. Wolfram bekräftar dessutom dina numeriska uppskattningar.",
      },
      {
        id: "st43",
        questionId: "q11",
        label: "4",
        maxPoints: 3,
        earnedPoints: 3,
        status: "correct",
        studentWork:
          "Jag ritar in en extra intervall där bilen bromsar och beräknar nya s och v med samma a.",
        feedback:
          "Claude: Du generaliserar modellen korrekt till ett nytt tidsintervall och visar alla steg. Wolfram ger samma bromssträcka, full poäng.",
      },
      {
        id: "st44",
        questionId: "q12",
        label: "5",
        maxPoints: 2,
        earnedPoints: 1,
        status: "partial",
        studentWork:
          "Jag skriver att resultatet kan bli fel om bilen inte accelererar helt jämnt men nämner inga fler exempel.",
        feedback:
          "Claude: Du är inne på rätt spår kring jämn acceleration men hade kunnat ge fler konkreta exempel, till exempel växlingar eller backar. Därför delpoäng.",
      },
    ],
    totalScore: 28,
    maxScore: 30,
    percentage: 93,
    grade: "A",
    scannedAt: "2024-04-10T10:01:00Z",
    gradedAt: "2024-04-10T10:11:00Z",
  },
  {
    id: "r8",
    provId: "prov2",
    studentId: "s3",
    studentName: "Maria Johansson",
    identificationMethod: "qr_code",
    identificationConfidence: 0.97,
    steps: [
      {
        id: "st32",
        questionId: "q5",
        label: "1",
        maxPoints: 8,
        earnedPoints: 5,
        status: "partial",
        studentWork:
          "Jag skriver a = 20 / 10 = 2 men glömmer enheten och räknar inte ut sträckan explicit.",
        feedback:
          "Claude: Du har hittat rätt acceleration men redovisar inte hela beräkningen och saknar enhet. Enligt klassens regler för tydlighet och enheter blir det delpoäng.",
      },
      {
        id: "st33",
        questionId: "q6",
        label: "2",
        maxPoints: 8,
        earnedPoints: 6,
        status: "partial",
        studentWork:
          "Jag använder s(t) = 3 t^2 men missar +2t-termen när jag räknar sträckan efter 4 s.",
        feedback:
          "Claude: Du har uppfattat formen på positionsfunktionen men tappar den linjära termen. Wolfram visar att ditt svar blir några meter för lågt, därför delvis korrekt.",
      },
      {
        id: "st34",
        questionId: "q7",
        label: "3",
        maxPoints: 9,
        earnedPoints: 7,
        status: "partial",
        studentWork:
          "Jag skriver att cyklisten rör sig snabbast där grafen är brantast men blandar ihop stillastående intervall med låg hastighet.",
        feedback:
          "Claude: Din idé om lutning och hastighet är bra, men du markerar även delar där grafen är horisontell som låg men inte noll hastighet. Grafen visar faktiskt stillastående där, så du får delpoäng.",
      },
      {
        id: "st45",
        questionId: "q11",
        label: "4",
        maxPoints: 3,
        earnedPoints: 2,
        status: "partial",
        studentWork:
          "Jag försöker uppskatta en ny bromssträcka men skriver bara att den blir längre utan att räkna.",
        feedback:
          "Claude: Du har rätt kvalitativt – sträckan blir längre – men utan beräkning eller siffra kan vi inte ge full poäng enligt klassreglerna.",
      },
      {
        id: "st46",
        questionId: "q12",
        label: "5",
        maxPoints: 2,
        earnedPoints: 2,
        status: "correct",
        studentWork:
          "Jag skriver att modellen inte funkar om föraren bromsar och släpper gasen flera gånger.",
        feedback:
          "Claude: Bra exempel på när antagandet om konstant acceleration bryter ihop. Det visar att du förstår modellens begränsningar.",
      },
    ],
    totalScore: 22,
    maxScore: 30,
    percentage: 73,
    grade: "C",
    scannedAt: "2024-04-10T10:02:00Z",
    gradedAt: "2024-04-10T10:12:00Z",
  },
  {
    id: "r9",
    provId: "prov2",
    studentId: "s4",
    studentName: "Johan Svensson",
    identificationMethod: "qr_code",
    identificationConfidence: 0.96,
    steps: [
      {
        id: "st35",
        questionId: "q5",
        label: "1",
        maxPoints: 8,
        earnedPoints: 8,
        status: "correct",
        studentWork:
          "Jag ritar ett v–t-diagram och visar att arean under kurvan ger samma sträcka som s = 0,5·a·t^2 = 100 m.",
        feedback:
          "Claude: Mycket bra koppling mellan v–t-diagram och formel. Wolfram bekräftar både accelerationen och sträckan, full poäng.",
      },
      {
        id: "st36",
        questionId: "q6",
        label: "2",
        maxPoints: 8,
        earnedPoints: 8,
        status: "correct",
        studentWork:
          "Jag deriverar s(t) = 3t^2 + 2t till v(t) = 6t + 2 och diskuterar hur farten växer linjärt med tiden.",
        feedback:
          "Claude: Ren och tydlig derivata med fysisk tolkning. Du uppfyller alla klassregler kring att visa mellanled.",
      },
      {
        id: "st37",
        questionId: "q7",
        label: "3",
        maxPoints: 9,
        earnedPoints: 8,
        status: "partial",
        studentWork:
          "Jag skriver att medelhastigheten kan läsas av som total sträcka / total tid men gör en liten avläsningsmiss i grafen.",
        feedback:
          "Claude: Resonemanget är helt korrekt men du läser av slutsträckan något för högt. Wolfram visar att det ger ca 0,5 m/s för mycket, därför 1 poäng avdrag.",
      },
      {
        id: "st47",
        questionId: "q11",
        label: "4",
        maxPoints: 3,
        earnedPoints: 3,
        status: "correct",
        studentWork:
          "Jag visar hur man kan använda samma v–t-diagram för att läsa av både bromssträcka och medelhastighet i ett nytt intervall.",
        feedback:
          "Claude: Du använder grafen mycket effektivt för att besvara en ny frågeställning. Alla mellanled och enheter är tydliga, full poäng.",
      },
      {
        id: "st48",
        questionId: "q12",
        label: "5",
        maxPoints: 2,
        earnedPoints: 2,
        status: "correct",
        studentWork:
          "Jag diskuterar att modellen inte tar hänsyn till vindmotstånd och att den därför överskattar hastigheten något.",
        feedback:
          "Claude: Mycket mogen reflektion kring modellfel och systematiska avvikelser. Detta är precis den typ av resonemang som stärker betyget.",
      },
    ],
    totalScore: 29,
    maxScore: 30,
    percentage: 97,
    grade: "A",
    scannedAt: "2024-04-10T10:03:00Z",
    gradedAt: "2024-04-10T10:13:00Z",
  },
  {
    id: "r10",
    provId: "prov2",
    studentId: "s5",
    studentName: "Lisa Nilsson",
    identificationMethod: "qr_code",
    identificationConfidence: 0.99,
    steps: [
      {
        id: "st38",
        questionId: "q5",
        label: "1",
        maxPoints: 8,
        earnedPoints: 7,
        status: "partial",
        studentWork:
          "Jag skriver a = 2 m/s^2 men hoppar över motiveringen och ritar inget diagram.",
        feedback:
          "Claude: Själva svaret är korrekt men enligt klassens krav på redovisning saknas mellanled och enhet i första steget. Därför delpoäng trots rätt siffra.",
      },
      {
        id: "st39",
        questionId: "q6",
        label: "2",
        maxPoints: 8,
        earnedPoints: 7,
        status: "partial",
        studentWork:
          "Jag använder s(t) = 3t^2 + 2t men avrundar till 30 m istället för 32 m och nämner inte enheten.",
        feedback:
          "Claude: Bra val av modell och beräkning, men du tappar poäng på dubbel avrundning och avsaknad av enhet. Wolfram visar exaktvärdet 32 m.",
      },
      {
        id: "st40",
        questionId: "q7",
        label: "3",
        maxPoints: 9,
        earnedPoints: 9,
        status: "correct",
        studentWork:
          "Jag förklarar hur man ser när cyklisten står still, när den accelererar och hur medelhastigheten kan uppskattas från grafen.",
        feedback:
          "Claude: Mycket tydlig kvalitativ beskrivning av hela rörelsen. Du använder begreppen hastighet, acceleration och medelhastighet helt korrekt.",
      },
      {
        id: "st49",
        questionId: "q11",
        label: "4",
        maxPoints: 3,
        earnedPoints: 2,
        status: "partial",
        studentWork:
          "Jag skriver att bromssträckan borde bli längre om vägen är hal men räknar inte om värdena.",
        feedback:
          "Claude: Din intuition stämmer, men utan ny beräkning kan vi bara ge delpoäng enligt klassens regler för uträkning.",
      },
      {
        id: "st50",
        questionId: "q12",
        label: "5",
        maxPoints: 2,
        earnedPoints: 2,
        status: "correct",
        studentWork:
          "Jag nämner att modellen inte tar hänsyn till reaktionstid innan bromsning och därför underskattar den verkliga stoppsträckan.",
        feedback:
          "Claude: Utmärkt exempel på en mänsklig faktor som modellen missar. Det visar att du kan tänka kritiskt kring resultatet.",
      },
    ],
    totalScore: 27,
    maxScore: 30,
    percentage: 90,
    grade: "A",
    scannedAt: "2024-04-10T10:04:00Z",
    gradedAt: "2024-04-10T10:14:00Z",
  },
  // =========================================================================
  // FYSIK 2 - Mekanik, svängningar och vågrörelse - Elin Karlsson
  // =========================================================================
  {
    id: "r11",
    provId: "prov4",
    studentId: "s11",
    studentName: "Elin Karlsson",
    identificationMethod: "name_field",
    identificationConfidence: 0.97,
    steps: [
      // Uppgift 1: Likformig acceleration (4p) - KORREKT
      {
        id: "elin1",
        questionId: "f2q1",
        label: "1",
        maxPoints: 4,
        earnedPoints: 4,
        status: "correct",
        studentWork: `Givet: v₀ = 0, v = 25 m/s, t = 8,0 s
Sökt: a, s

a = Δv/Δt = (25 - 0)/8,0 = 3,125 m/s²
≈ 3,1 m/s²

s = v₀t + ½at²
s = 0 + ½ · 3,125 · 8,0²
s = 0,5 · 3,125 · 64
s = 100 m

Svar: a = 3,1 m/s², s = 100 m`,
        feedback: "Claude: Helt korrekt lösning med tydliga mellanled. Du visar formel, insättning och avrundning på ett exemplariskt sätt. Wolfram bekräftar båda svaren.",
      },
      // Uppgift 2: Kastparabel (5p) - KORREKT
      {
        id: "elin2",
        questionId: "f2q2",
        label: "2",
        maxPoints: 5,
        earnedPoints: 5,
        status: "correct",
        studentWork: `Givet: v₀ = 18 m/s, α = 35°, g = 9,82 m/s²
Sökt: max höjd h, räckvidd R

v₀ₓ = v₀ · cos(35°) = 18 · 0,819 = 14,7 m/s
v₀ᵧ = v₀ · sin(35°) = 18 · 0,574 = 10,3 m/s

Max höjd: vᵧ = 0
vᵧ² = v₀ᵧ² - 2gh
0 = 10,3² - 2 · 9,82 · h
h = 106,09 / 19,64 = 5,4 m

Tid upp: t = v₀ᵧ/g = 10,3/9,82 = 1,05 s
Total tid: T = 2t = 2,1 s

R = v₀ₓ · T = 14,7 · 2,1 = 30,9 m

Svar: h = 5,4 m, R = 31 m`,
        feedback: "Claude: Utmärkt! Du delar upp hastigheten i komponenter korrekt och använder rätt kinematiska ekvationer. Alla mellanled är tydliga och svaren stämmer med facit.",
      },
      // Uppgift 3: Newtons lagar (4p) - KORREKT
      {
        id: "elin3",
        questionId: "f2q3",
        label: "3",
        maxPoints: 4,
        earnedPoints: 4,
        status: "correct",
        studentWork: `Givet: m = 1200 kg, F_motor = 4500 N, μ = 0,08
Sökt: acceleration a

Friktionskraft:
f = μ · N = μ · mg
f = 0,08 · 1200 · 9,82 = 942,7 N

Nettokraft:
F_netto = F_motor - f = 4500 - 942,7 = 3557,3 N

Newtons 2:a lag:
a = F_netto/m = 3557,3/1200 = 2,96 m/s²

Svar: a ≈ 3,0 m/s²`,
        feedback: "Claude: Perfekt tillämpning av Newtons andra lag med friktion. Du identifierar alla krafter korrekt och beräknar nettokraften innan du bestämmer accelerationen.",
      },
      // Uppgift 4: Rörelsemängd (4p) - KORREKT
      {
        id: "elin4",
        questionId: "f2q4",
        label: "4",
        maxPoints: 4,
        earnedPoints: 4,
        status: "correct",
        studentWork: `Givet: m₁ = 1500 kg, v₁ = 20 m/s, m₂ = 1000 kg, v₂ = 0
Elastisk stöt i en dimension
Sökt: v₁' och v₂'

Rörelsemängdens bevarande:
m₁v₁ + m₂v₂ = m₁v₁' + m₂v₂'
1500·20 + 0 = 1500·v₁' + 1000·v₂'
30000 = 1500v₁' + 1000v₂'  ... (1)

Energins bevarande (elastisk):
v₁ - v₂ = -(v₁' - v₂')
20 - 0 = v₂' - v₁'
v₂' = v₁' + 20  ... (2)

Sätt in (2) i (1):
30000 = 1500v₁' + 1000(v₁' + 20)
30000 = 2500v₁' + 20000
v₁' = 10000/2500 = 4 m/s

v₂' = 4 + 20 = 24 m/s

Svar: v₁' = 4 m/s, v₂' = 24 m/s`,
        feedback: "Claude: Exemplarisk lösning av elastisk stöt! Du använder både rörelsemängdens och energins bevarande korrekt, och löser ekvationssystemet systematiskt.",
      },
      // Uppgift 5: Impuls (4p) - DELVIS KORREKT (glömmer riktning)
      {
        id: "elin5",
        questionId: "f2q5",
        label: "5",
        maxPoints: 4,
        earnedPoints: 3,
        status: "partial",
        studentWork: `Givet: m = 0,45 kg, v₁ = 25 m/s, v₂ = 18 m/s (efter studs)
Kontakttid Δt = 0,012 s
Sökt: Impuls I, Medelkraft F

Impuls = ändring i rörelsemängd
I = Δp = m·Δv = m·(v₂ - v₁)
I = 0,45 · (18 - 25) = 0,45 · (-7)
I = -3,15 Ns

Nej vänta, bollen studsar tillbaka så:
I = 0,45 · (25 + 18) = 0,45 · 43
I = 19,35 Ns ≈ 19 Ns

F = I/Δt = 19,35/0,012 = 1612,5 N
≈ 1600 N

Svar: I = 19 Ns, F = 1600 N`,
        feedback: "Claude: Du korrigerar dig själv vilket är bra! Men du tappar 1 poäng för att du inte anger riktning på impulsen. Impulsen är en vektor och bör anges som 19 Ns i bollens rörelseriktning efter studsen.",
      },
      // Uppgift 6: Fjäderkraft och Hookes lag (3p) - KORREKT
      {
        id: "elin6",
        questionId: "f2q6",
        label: "6",
        maxPoints: 3,
        earnedPoints: 3,
        status: "correct",
        studentWork: `Givet: k = 450 N/m, x = 0,12 m (ihoptryckt)
Sökt: Kraft F, Potentiell energi E_p

Hookes lag:
F = k · x = 450 · 0,12 = 54 N

Potentiell energi i fjäder:
E_p = ½kx² = ½ · 450 · 0,12²
E_p = 225 · 0,0144 = 3,24 J

Svar: F = 54 N, E_p = 3,2 J`,
        feedback: "Claude: Korrekt tillämpning av Hookes lag och formeln för fjäderenergi. Tydliga mellanled och korrekt avrundning.",
      },
      // Uppgift 7: Harmonisk svängning (4p) - DELVIS KORREKT (fel i perioden)
      {
        id: "elin7",
        questionId: "f2q7",
        label: "7",
        maxPoints: 4,
        earnedPoints: 2,
        status: "partial",
        studentWork: `Givet: m = 0,5 kg, k = 200 N/m, A = 0,08 m
Sökt: Period T, max hastighet v_max

Vinkelfrekvens:
ω = √(k/m) = √(200/0,5) = √400 = 20 rad/s

Period:
T = 2π/ω = 2 · 3,14/20 = 6,28/20 = 0,314 s

Nej det blir fel... T = 2π · √(m/k)
T = 2 · 3,14 · √(0,5/200)
T = 6,28 · √0,0025 = 6,28 · 0,05
T = 0,314 s

Max hastighet:
v_max = ω · A = 20 · 0,08 = 1,6 m/s

Svar: T = 0,31 s, v_max = 1,6 m/s`,
        feedback: "Claude: Du räknar ut ω korrekt och v_max stämmer. Men du gör ett teckenfel i periodberäkningen – du använder √(m/k) istället för att bara ta 2π/ω direkt. Rätt period är T = 2π/20 ≈ 0,31 s, så svaret råkar bli rätt men mellanledet med √(m/k) = 0,05 är fel (ska vara √(0,5/200) = 0,05, men formeln T = 2π√(m/k) ger 0,31 s). Du får delpoäng för korrekt ω och v_max.",
      },
      // Uppgift 8: Pendelrörelse (4p) - KORREKT
      {
        id: "elin8",
        questionId: "f2q8",
        label: "8",
        maxPoints: 4,
        earnedPoints: 4,
        status: "correct",
        studentWork: `Givet: L = 2,0 m, g = 9,82 m/s²
Sökt: Period T, frekvens f

Matematisk pendel:
T = 2π · √(L/g)
T = 2 · 3,14159 · √(2,0/9,82)
T = 6,283 · √0,2037
T = 6,283 · 0,4513
T = 2,836 s ≈ 2,8 s

Frekvens:
f = 1/T = 1/2,836 = 0,353 Hz
≈ 0,35 Hz

Svar: T = 2,8 s, f = 0,35 Hz`,
        feedback: "Claude: Perfekt! Du använder rätt formel för matematisk pendel och beräknar både period och frekvens korrekt med lämplig noggrannhet.",
      },
      // Uppgift 9: Mekanisk energi (5p) - FELAKTIG (glömmer höjdskillnad)
      {
        id: "elin9",
        questionId: "f2q9",
        label: "9",
        maxPoints: 5,
        earnedPoints: 1,
        status: "incorrect",
        studentWork: `Givet: m = 2,0 kg, h = 5,0 m (startar från vila)
Sökt: Hastighet v vid botten

Energibevarande:
E_k1 + E_p1 = E_k2 + E_p2

Vid start: E_k1 = 0, E_p1 = mgh
Vid botten: E_p2 = 0

mgh = ½mv²
gh = ½v²
v² = 2gh = 2 · 9,82 · 5,0 = 98,2
v = 9,9 m/s

Men vänta, det står att det är en lutande bana med friktion μ = 0,15 och längd s = 12 m...

Jag räknar utan friktion:
v = √(2gh) = √98,2 = 9,9 m/s

Svar: v = 9,9 m/s`,
        feedback: "Claude: Du börjar rätt med energibevarande men ignorerar sedan friktionen som anges i uppgiften. Med friktion blir arbetet W_f = μmg·cos(θ)·s negativt och måste subtraheras. Rätt svar är ca 7,8 m/s. Du får 1 poäng för korrekt ansats utan friktion.",
      },
      // Uppgift 10: Våglängd och frekvens (4p) - KORREKT
      {
        id: "elin10",
        questionId: "f2q10",
        label: "10",
        maxPoints: 4,
        earnedPoints: 4,
        status: "correct",
        studentWork: `Givet: f = 440 Hz (kammarton A), v = 343 m/s (ljud i luft)
Sökt: Våglängd λ

Sambandet:
v = f · λ

λ = v/f = 343/440 = 0,780 m

Svar: λ = 0,78 m = 78 cm`,
        feedback: "Claude: Korrekt! Du använder vågekvationen rätt och anger svaret med lämplig noggrannhet och enhet.",
      },
      // Uppgift 11: Interferens (4p) - FELAKTIG (fel i gångskillnad)
      {
        id: "elin11",
        questionId: "f2q11",
        label: "11",
        maxPoints: 4,
        earnedPoints: 0,
        status: "incorrect",
        studentWork: `Givet: d = 0,25 mm = 0,00025 m, λ = 632 nm = 632·10⁻⁹ m
Avstånd till skärm L = 2,0 m
Sökt: Avstånd mellan interferensmaxima Δy

Konstruktiv interferens när:
d·sin(θ) = n·λ

För små vinklar: sin(θ) ≈ tan(θ) = y/L

Första maximum (n=1):
d · y/L = λ
y = λ·L/d = (632·10⁻⁹ · 2,0) / 0,00025
y = 1264·10⁻⁹ / 0,00025
y = 5,056·10⁻³ m = 5,1 mm

Δy = 5,1 mm

Nej vänta, jag tror jag räknade fel...
y = (632·10⁻⁹ · 2) / (2,5·10⁻⁴)
y = 1264·10⁻⁹ / 2,5·10⁻⁴
y = 505,6·10⁻⁵ = 5,056·10⁻³

Svar: Δy = 5,1 mm`,
        feedback: "Claude: Du har rätt formel men gör ett enhetsfel. d = 0,25 mm = 2,5·10⁻⁴ m, inte 0,00025 m (vilket faktiskt är samma sak, men du skriver 2,5·10⁻⁴ i uträkningen). Problemet är att du blandar ihop dig själv och får rätt svar av fel anledning. Rätt svar är faktiskt ca 5,1 mm, men dina mellanled visar förvirring. Du får 0 poäng eftersom lösningen inte är konsekvent.",
      },
      // Uppgift 12: Dopplereffekt (3p) - KORREKT
      {
        id: "elin12",
        questionId: "f2q12",
        label: "12",
        maxPoints: 3,
        earnedPoints: 3,
        status: "correct",
        studentWork: `Givet: f₀ = 500 Hz (ambulans), v_s = 30 m/s (ambulansens fart)
v = 343 m/s (ljudets hastighet)
Sökt: Uppfattad frekvens f när ambulansen närmar sig

Dopplereffekt (källa närmar sig):
f = f₀ · v/(v - v_s)
f = 500 · 343/(343 - 30)
f = 500 · 343/313
f = 500 · 1,096
f = 548 Hz

Svar: f ≈ 550 Hz`,
        feedback: "Claude: Helt rätt! Du använder korrekt Dopplerformel för en källa som närmar sig och får ett rimligt svar. Frekvensen ökar som förväntat.",
      },
    ],
    totalScore: 33,
    maxScore: 48,
    percentage: 69,
    grade: "C",
    scannedAt: "2024-06-05T10:00:00Z",
    gradedAt: "2024-06-05T10:25:00Z",
  },
];

// ============================================================================
// MEKANIKPROV MOCK — 10 elever, 10 uppgifter, handskrivna svar per elev
// Injicerar sig i det befintliga provet fysik2-prov1 så demoflödet
// /classes/na22b-fysik2/grade/fysik2-prov1 blir fullt av liv.
// ============================================================================

interface MekStep {
  id: string;
  label: string;
  studentAnswer: string;
  correctAnswer: string;
  pointsBase: number;
  pointsMax: number;
  verdict: "correct" | "partial" | "incorrect";
  aiFeedback: string;
}

interface MekStudent {
  studentId: string;
  studentName: string;
  scanPages: [string, string];
  steps: MekStep[];
}

const MEK_QUESTIONS: Question[] = [
  { id: "q1", number: "1", maxPoints: 2 },
  { id: "q2", number: "2", maxPoints: 2 },
  { id: "q3", number: "3", maxPoints: 3 },
  { id: "q4", number: "4", maxPoints: 2 },
  { id: "q5", number: "5", maxPoints: 2 },
  { id: "q6", number: "6", maxPoints: 3 },
  { id: "q7", number: "7", maxPoints: 2 },
  { id: "q8", number: "8", maxPoints: 2 },
  { id: "q9", number: "9", maxPoints: 3 },
  { id: "q10", number: "10", maxPoints: 2 },
];

const MEK_FACIT = `1) F = ma = 5 × 2 = 10 N (2p)
2) v = s/t = 100/20 = 5 m/s (2p)
3) E = mgh = 2 × 10 × 15 = 300 J (3p)
4) x = 6 (lös 3x – 6 = 12) (2p)
5) a = F/m = 20/4 = 5 m/s² (2p)
6) Ek = ½mv² = ½ × 3 × 16 = 24 J (3p)
7) W = Fs = 50 × 8 = 400 J (2p)
8) p = mv = 6 × 5 = 30 kg·m/s (2p)
9) ρ = m/V = 500/100 = 5 g/cm³ (3p)
10) P = W/t = 600/3 = 200 W (2p)
Totalt: 23p`;

const MEK_STUDENTS: MekStudent[] = [
  {
    studentId: "mek1",
    studentName: "Erik Andersson",
    scanPages: [
`Namn: Erik Andersson     Klass: NA22B
Datum: 14 maj 2026

1)  F = m · a
    F = 5 · 2
    F = 10 N  ✓

2)  v = s / t
    v = 100 / 20
    v = 5 m/s  ✓

3)  E = m · g · h
    E = 2 · 10 · 15
    E = 300 J  ✓

4)  3x - 6 = 12
    3x = 18
    x = 6  ✓

5)  a = F / m
    a = 20 / 4
    a = 5 m/s²  ✓`,
`6)  Ek = ½ · m · v²
    Ek = ½ · 3 · 4²
    Ek = ½ · 3 · 16
    Ek = 24 J  ✓

7)  W = F · s
    W = 50 · 8
    W = 400 J  ✓

8)  p = m · v
    p = 6 · 5
    p = 30 kg·m/s  ✓

9)  ρ = m / V
    ρ = 500 / 100
    ρ = 5 g/cm³  ✓

10) P = W / t
    P = 600 / 3
    P = 200 W  ✓

Totalt: 23/23p`,
    ],
    steps: [
      { id: "s1-001", label: "Uppgift 1", studentAnswer: "F = 5 · 2 = 10 N", correctAnswer: "F = 10 N", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Perfekt lösning! Du har korrekt tillämpat Newtons andra lag med fullständiga uträkningssteg och rätt enhet." },
      { id: "s2-001", label: "Uppgift 2", studentAnswer: "v = 100/20 = 5 m/s", correctAnswer: "v = 5 m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt! Bra att du visar hela uträkningen och inkluderar enheten m/s." },
      { id: "s3-001", label: "Uppgift 3", studentAnswer: "E = 2·10·15 = 300 J", correctAnswer: "E = 300 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Utmärkt! Fullständig lösning med korrekt formel, uträkning och enhet." },
      { id: "s4-001", label: "Uppgift 4", studentAnswer: "3x = 18, x = 6", correctAnswer: "x = 6", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt algebraisk lösning med tydliga steg." },
      { id: "s5-001", label: "Uppgift 5", studentAnswer: "a = 20/4 = 5 m/s²", correctAnswer: "a = 5 m/s²", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt formel, rätt uträkning, rätt enhet. Bra jobbat!" },
      { id: "s6-001", label: "Uppgift 6", studentAnswer: "Ek = ½·3·16 = 24 J", correctAnswer: "Ek = 24 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Perfekt! Du har korrekt beräknat v² = 16 och multiplicerat med ½m." },
      { id: "s7-001", label: "Uppgift 7", studentAnswer: "W = 50·8 = 400 J", correctAnswer: "W = 400 J", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt! Arbetsformeln korrekt tillämpad." },
      { id: "s8-001", label: "Uppgift 8", studentAnswer: "p = 6·5 = 30 kg·m/s", correctAnswer: "p = 30 kg·m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt rörelsemängd med rätt enhet kg·m/s." },
      { id: "s9-001", label: "Uppgift 9", studentAnswer: "ρ = 500/100 = 5 g/cm³", correctAnswer: "ρ = 5 g/cm³", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Utmärkt! Rätt formel och korrekt hantering av enheterna." },
      { id: "s10-001", label: "Uppgift 10", studentAnswer: "P = 600/3 = 200 W", correctAnswer: "P = 200 W", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Perfekt! Effektformeln korrekt tillämpad med rätt enhet Watt." },
    ],
  },
  {
    studentId: "mek2",
    studentName: "Liam Johansson",
    scanPages: [
`Namn: Liam Johansson     Klass: NA22B
Datum: 14 maj 2026

1)  F = m + a  ???
    F = 5 + 2 = 7
    svar: 7  (glömde enhet)

2)  v = s · t
    v = 100 · 20 = 2000
    svar: 2000

3)  E = m + g + h
    E = 2 + 10 + 15 = 27
    svar: 27

4)  3x - 6 = 12
    3x = 6
    x = 2

5)  a = F · m
    a = 20 · 4 = 80
    svar: 80`,
`6)  Ek = m · v
    Ek = 3 · 4 = 12
    svar: 12

7)  W = F + s
    W = 50 + 8 = 58
    svar: 58 J

8)  p = m + v
    p = 6 + 5 = 11
    svar: 11

9)  ρ = m · V
    ρ = 500 · 100 = ?
    vet ej

10) P = W · t
    P = 600 · 3 = 1800
    svar: 1800`,
    ],
    steps: [
      { id: "s1-002", label: "Uppgift 1", studentAnswer: "F = 5 + 2 = 7", correctAnswer: "F = 10 N", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel formel. Du har adderat m och a istället för att multiplicera. F = m · a = 5 · 2 = 10 N. Newtons andra lag innebär multiplikation, inte addition. Enheten Newton (N) saknades också." },
      { id: "s2-002", label: "Uppgift 2", studentAnswer: "v = 100 · 20 = 2000", correctAnswer: "v = 5 m/s", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel operation. Hastighet = sträcka DIVIDERAT med tid, inte multiplicerat. v = 100 / 20 = 5 m/s. Kom ihåg: v = s/t." },
      { id: "s3-002", label: "Uppgift 3", studentAnswer: "E = 2 + 10 + 15 = 27", correctAnswer: "E = 300 J", pointsBase: 0, pointsMax: 3, verdict: "incorrect", aiFeedback: "Fel formel. Lägesenergi = m · g · h (alla tre multipliceras). E = 2 · 10 · 15 = 300 J. Du har adderat värdena istället." },
      { id: "s4-002", label: "Uppgift 4", studentAnswer: "3x = 6, x = 2", correctAnswer: "x = 6", pointsBase: 1, pointsMax: 2, verdict: "partial", aiFeedback: "Du har rätt ansats men fel räkning. 3x – 6 = 12 → 3x = 12 + 6 = 18 → x = 6. Du subtraherade 6 istället för att addera." },
      { id: "s5-002", label: "Uppgift 5", studentAnswer: "a = 20 · 4 = 80", correctAnswer: "a = 5 m/s²", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel formel. Acceleration = Kraft DIVIDERAT med massa. a = F/m = 20/4 = 5 m/s². Du multiplicerade istället för att dividera." },
      { id: "s6-002", label: "Uppgift 6", studentAnswer: "Ek = 3 · 4 = 12", correctAnswer: "Ek = 24 J", pointsBase: 0, pointsMax: 3, verdict: "incorrect", aiFeedback: "Fel formel. Rörelseenergi = ½ · m · v². Du glömde halvera och kvadrera hastigheten. Ek = ½ · 3 · 4² = ½ · 3 · 16 = 24 J." },
      { id: "s7-002", label: "Uppgift 7", studentAnswer: "W = 50 + 8 = 58 J", correctAnswer: "W = 400 J", pointsBase: 1, pointsMax: 2, verdict: "partial", aiFeedback: "Rätt enhet (J) men fel operation. Arbete = Kraft · sträcka (multiplikation). W = 50 · 8 = 400 J. Du adderade istället." },
      { id: "s8-002", label: "Uppgift 8", studentAnswer: "p = 6 + 5 = 11", correctAnswer: "p = 30 kg·m/s", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel operation. Rörelsemängd = massa · hastighet. p = 6 · 5 = 30 kg·m/s. Du adderade istället för att multiplicera." },
      { id: "s9-002", label: "Uppgift 9", studentAnswer: "ρ = 500 · 100 = ?", correctAnswer: "ρ = 5 g/cm³", pointsBase: 0, pointsMax: 3, verdict: "incorrect", aiFeedback: "Fel formel. Densitet = massa DIVIDERAT med volym. ρ = m/V = 500/100 = 5 g/cm³. Du multiplicerade och fick inget rimligt svar." },
      { id: "s10-002", label: "Uppgift 10", studentAnswer: "P = 600 · 3 = 1800", correctAnswer: "P = 200 W", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel operation. Effekt = Arbete DIVIDERAT med tid. P = W/t = 600/3 = 200 W. Du multiplicerade istället för att dividera." },
    ],
  },
  {
    studentId: "mek3",
    studentName: "Maja Lindberg",
    scanPages: [
`Namn: Maja Lindberg     Klass: NA22B
Datum: 14 maj 2026

1)  F = m · a = 5 · 2 = 10 N  ✓

2)  v = s/t = 100/20 = 5 m/s  ✓

3)  E = mgh = 2 · 10 · 15 = 300 J  ✓

4)  3x - 6 = 12
    3x = 18
    x = 6  ✓

5)  a = F/m = 20/4 = 5 m/s²  ✓`,
`6)  Ek = ½mv² = ½ · 3 · 16 = 24 J  ✓

7)  W = F · s = 50 · 8 = 400 J  ✓

8)  p = mv = 6 · 5 = 30  (glömde enhet)

9)  ρ = m/V = 500/100 = 5  (glömde enhet)

10) P = W/t = 600/3 = 200 W  ✓`,
    ],
    steps: [
      { id: "s1-003", label: "Uppgift 1", studentAnswer: "F = 5·2 = 10 N", correctAnswer: "F = 10 N", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Perfekt lösning med korrekt formel, uträkning och enhet." },
      { id: "s2-003", label: "Uppgift 2", studentAnswer: "v = 100/20 = 5 m/s", correctAnswer: "v = 5 m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt! Tydlig och korrekt lösning." },
      { id: "s3-003", label: "Uppgift 3", studentAnswer: "E = 2·10·15 = 300 J", correctAnswer: "E = 300 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Utmärkt! Fullständig och korrekt lösning." },
      { id: "s4-003", label: "Uppgift 4", studentAnswer: "3x = 18, x = 6", correctAnswer: "x = 6", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt med tydliga algebraiska steg." },
      { id: "s5-003", label: "Uppgift 5", studentAnswer: "a = 20/4 = 5 m/s²", correctAnswer: "a = 5 m/s²", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt formel och korrekt uträkning." },
      { id: "s6-003", label: "Uppgift 6", studentAnswer: "Ek = ½·3·16 = 24 J", correctAnswer: "Ek = 24 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Perfekt! Korrekt formel med v² = 16." },
      { id: "s7-003", label: "Uppgift 7", studentAnswer: "W = 50·8 = 400 J", correctAnswer: "W = 400 J", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt! Arbetsformeln korrekt tillämpad." },
      { id: "s8-003", label: "Uppgift 8", studentAnswer: "p = 6·5 = 30 (enhet saknas)", correctAnswer: "p = 30 kg·m/s", pointsBase: 1, pointsMax: 2, verdict: "partial", aiFeedback: "Rätt beräkning men enheten kg·m/s saknas. Kom ihåg att alltid ange enhet på rörelsemängd. –0,25p avdrag." },
      { id: "s9-003", label: "Uppgift 9", studentAnswer: "ρ = 500/100 = 5 (enhet saknas)", correctAnswer: "ρ = 5 g/cm³", pointsBase: 2, pointsMax: 3, verdict: "partial", aiFeedback: "Rätt beräkning men enheten g/cm³ saknas. Densitetens enhet är viktig att ange. –0,25p avdrag." },
      { id: "s10-003", label: "Uppgift 10", studentAnswer: "P = 600/3 = 200 W", correctAnswer: "P = 200 W", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt! Effektformeln korrekt tillämpad." },
    ],
  },
  {
    studentId: "mek4",
    studentName: "Oscar Nilsson",
    scanPages: [
`Namn: Oscar Nilsson     Klass: NA22B
Datum: 14 maj 2026

1)  F = ma = 5·2 = 10 N  ✓

2)  v = s/t = 100/20 = 5 m/s  ✓

3)  E = mgh
    E = 2·10·15... hmm
    E = 200 J? (räknade fel)

4)  3x - 6 = 12
    3x = 18
    x = 6  ✓

5)  a = F/m = 20/4 = 5 m/s²  ✓`,
`6)  Ek = ½mv²
    Ek = ½ · 3 · 4 = 6 J  (glömde kvadrera v)

7)  W = Fs = 50·8 = 400 J  ✓

8)  p = mv = 6·5 = 30 kg·m/s  ✓

9)  ρ = m/V = 500/100 = 5 g/cm³  ✓

10) P = W·t = 600·3 = 1800  (fel formel)`,
    ],
    steps: [
      { id: "s1-004", label: "Uppgift 1", studentAnswer: "F = 5·2 = 10 N", correctAnswer: "F = 10 N", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Perfekt! Rätt formel och enhet." },
      { id: "s2-004", label: "Uppgift 2", studentAnswer: "v = 100/20 = 5 m/s", correctAnswer: "v = 5 m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s3-004", label: "Uppgift 3", studentAnswer: "E = 200 J", correctAnswer: "E = 300 J", pointsBase: 1, pointsMax: 3, verdict: "partial", aiFeedback: "Rätt formel men fel uträkning. E = 2·10·15 = 300 J, inte 200 J. Kontrollera dina mellansteg — troligen ett räknefel i multiplikationen." },
      { id: "s4-004", label: "Uppgift 4", studentAnswer: "x = 6", correctAnswer: "x = 6", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt!" },
      { id: "s5-004", label: "Uppgift 5", studentAnswer: "a = 20/4 = 5 m/s²", correctAnswer: "a = 5 m/s²", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s6-004", label: "Uppgift 6", studentAnswer: "Ek = ½·3·4 = 6 J", correctAnswer: "Ek = 24 J", pointsBase: 1, pointsMax: 3, verdict: "partial", aiFeedback: "Du glömde kvadrera hastigheten. v² = 4² = 16, inte 4. Ek = ½·3·16 = 24 J. Kom ihåg: det är v² i formeln för rörelseenergi." },
      { id: "s7-004", label: "Uppgift 7", studentAnswer: "W = 50·8 = 400 J", correctAnswer: "W = 400 J", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s8-004", label: "Uppgift 8", studentAnswer: "p = 6·5 = 30 kg·m/s", correctAnswer: "p = 30 kg·m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt med rätt enhet!" },
      { id: "s9-004", label: "Uppgift 9", studentAnswer: "ρ = 500/100 = 5 g/cm³", correctAnswer: "ρ = 5 g/cm³", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Perfekt!" },
      { id: "s10-004", label: "Uppgift 10", studentAnswer: "P = 600·3 = 1800", correctAnswer: "P = 200 W", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel formel. P = W/t (division, inte multiplikation). P = 600/3 = 200 W. Enheten Watt (W) saknades också." },
    ],
  },
  {
    studentId: "mek5",
    studentName: "Ella Pettersson",
    scanPages: [
`Namn: Ella Pettersson     Klass: NA22B
Datum: 14 maj 2026

1)  F = m · a = 5 · 2 = 10 N  ✓

2)  v = s/t = 100/20 = 5 m/s  ✓

3)  E = mgh = 2 · 10 · 15 = 300 J  ✓

4)  3x - 6 = 12 → x = 6  ✓

5)  a = F/m = 20/4 = 5 m/s²  ✓`,
`6)  Ek = ½mv² = ½·3·16 = 24 J  ✓

7)  W = Fs = 50·8 = 400 J  ✓

8)  p = mv = 6·5 = 30 kg·m/s  ✓

9)  ρ = m/V = 500/100 = 5 g/cm³  ✓

10) P = W/t = 600/3 = 200  (W saknas)`,
    ],
    steps: [
      { id: "s1-005", label: "Uppgift 1", studentAnswer: "F = 10 N", correctAnswer: "F = 10 N", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Perfekt!" },
      { id: "s2-005", label: "Uppgift 2", studentAnswer: "v = 5 m/s", correctAnswer: "v = 5 m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s3-005", label: "Uppgift 3", studentAnswer: "E = 300 J", correctAnswer: "E = 300 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Utmärkt!" },
      { id: "s4-005", label: "Uppgift 4", studentAnswer: "x = 6", correctAnswer: "x = 6", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt!" },
      { id: "s5-005", label: "Uppgift 5", studentAnswer: "a = 5 m/s²", correctAnswer: "a = 5 m/s²", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s6-005", label: "Uppgift 6", studentAnswer: "Ek = 24 J", correctAnswer: "Ek = 24 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Perfekt uträkning!" },
      { id: "s7-005", label: "Uppgift 7", studentAnswer: "W = 400 J", correctAnswer: "W = 400 J", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s8-005", label: "Uppgift 8", studentAnswer: "p = 30 kg·m/s", correctAnswer: "p = 30 kg·m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt!" },
      { id: "s9-005", label: "Uppgift 9", studentAnswer: "ρ = 5 g/cm³", correctAnswer: "ρ = 5 g/cm³", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Utmärkt!" },
      { id: "s10-005", label: "Uppgift 10", studentAnswer: "P = 200 (enhet W saknas)", correctAnswer: "P = 200 W", pointsBase: 1.75, pointsMax: 2, verdict: "partial", aiFeedback: "Rätt beräkning men enheten Watt (W) saknas. –0,25p avdrag enligt klassregler." },
    ],
  },
  {
    studentId: "mek6",
    studentName: "William Karlsson",
    scanPages: [
`Namn: William Karlsson     Klass: NA22B
Datum: 14 maj 2026

1)  F = ma = 5·2 = 10 N  ✓

2)  v = s·t = 100·20 = 2000 m/s  (fel formel)

3)  E = mgh = 2·10·15 = 300 J  ✓

4)  3x - 6 = 12
    x = 12 - 6 / 3 = 2  (fel ordning)

5)  a = F/m = 20/4 = 5 m/s²  ✓`,
`6)  Ek = mv² = 3·16 = 48 J  (glömde ½)

7)  W = Fs = 50·8 = 400 J  ✓

8)  p = mv = 6·5 = 30  (enhet saknas)

9)  ρ = m·V = 500·100 = ?  (fel formel)

10) P = W/t = 600/3 = 200 W  ✓`,
    ],
    steps: [
      { id: "s1-006", label: "Uppgift 1", studentAnswer: "F = 10 N", correctAnswer: "F = 10 N", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s2-006", label: "Uppgift 2", studentAnswer: "v = 100·20 = 2000 m/s", correctAnswer: "v = 5 m/s", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel formel. v = s/t (division). v = 100/20 = 5 m/s. Du multiplicerade sträcka och tid istället." },
      { id: "s3-006", label: "Uppgift 3", studentAnswer: "E = 300 J", correctAnswer: "E = 300 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Perfekt!" },
      { id: "s4-006", label: "Uppgift 4", studentAnswer: "x = 2", correctAnswer: "x = 6", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel operationsordning. Flytta -6 till höger sidan: 3x = 12 + 6 = 18, sedan x = 18/3 = 6." },
      { id: "s5-006", label: "Uppgift 5", studentAnswer: "a = 5 m/s²", correctAnswer: "a = 5 m/s²", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s6-006", label: "Uppgift 6", studentAnswer: "Ek = 3·16 = 48 J", correctAnswer: "Ek = 24 J", pointsBase: 1, pointsMax: 3, verdict: "partial", aiFeedback: "Du glömde faktorn ½ i formeln. Ek = ½·m·v² = ½·3·16 = 24 J, inte 48 J. Halvera alltid resultatet." },
      { id: "s7-006", label: "Uppgift 7", studentAnswer: "W = 400 J", correctAnswer: "W = 400 J", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s8-006", label: "Uppgift 8", studentAnswer: "p = 30 (enhet saknas)", correctAnswer: "p = 30 kg·m/s", pointsBase: 1, pointsMax: 2, verdict: "partial", aiFeedback: "Rätt värde men enheten kg·m/s saknas. –0,25p avdrag." },
      { id: "s9-006", label: "Uppgift 9", studentAnswer: "ρ = 500·100 = ?", correctAnswer: "ρ = 5 g/cm³", pointsBase: 0, pointsMax: 3, verdict: "incorrect", aiFeedback: "Fel formel. Densitet = massa DIVIDERAT med volym. ρ = 500/100 = 5 g/cm³." },
      { id: "s10-006", label: "Uppgift 10", studentAnswer: "P = 200 W", correctAnswer: "P = 200 W", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Perfekt!" },
    ],
  },
  {
    studentId: "mek7",
    studentName: "Alice Svensson",
    scanPages: [
`Namn: Alice Svensson     Klass: NA22B
Datum: 14 maj 2026

1)  F = ma = 5·2 = 10 N  ✓
2)  v = s/t = 100/20 = 5 m/s  ✓
3)  E = mgh = 2·10·15 = 300 J  ✓
4)  3x-6=12, 3x=18, x=6  ✓
5)  a = F/m = 20/4 = 5 m/s²  ✓`,
`6)  Ek = ½mv² = ½·3·16 = 24 J  ✓
7)  W = Fs = 50·8 = 400 J  ✓
8)  p = mv = 6·5 = 30 kg·m/s  ✓
9)  ρ = m/V... 500÷100 = 50?  (räknade fel)
10) P = W/t = 600/3 = 200 W  ✓`,
    ],
    steps: [
      { id: "s1-007", label: "Uppgift 1", studentAnswer: "F = 10 N", correctAnswer: "F = 10 N", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s2-007", label: "Uppgift 2", studentAnswer: "v = 5 m/s", correctAnswer: "v = 5 m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s3-007", label: "Uppgift 3", studentAnswer: "E = 300 J", correctAnswer: "E = 300 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Perfekt!" },
      { id: "s4-007", label: "Uppgift 4", studentAnswer: "x = 6", correctAnswer: "x = 6", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt!" },
      { id: "s5-007", label: "Uppgift 5", studentAnswer: "a = 5 m/s²", correctAnswer: "a = 5 m/s²", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s6-007", label: "Uppgift 6", studentAnswer: "Ek = 24 J", correctAnswer: "Ek = 24 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Utmärkt!" },
      { id: "s7-007", label: "Uppgift 7", studentAnswer: "W = 400 J", correctAnswer: "W = 400 J", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s8-007", label: "Uppgift 8", studentAnswer: "p = 30 kg·m/s", correctAnswer: "p = 30 kg·m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt!" },
      { id: "s9-007", label: "Uppgift 9", studentAnswer: "ρ = 50 g/cm³", correctAnswer: "ρ = 5 g/cm³", pointsBase: 0, pointsMax: 3, verdict: "incorrect", aiFeedback: "Rätt formel men fel division. 500÷100 = 5, inte 50. Kontrollera räkneoperationen." },
      { id: "s10-007", label: "Uppgift 10", studentAnswer: "P = 200 W", correctAnswer: "P = 200 W", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
    ],
  },
  {
    studentId: "mek8",
    studentName: "Hugo Berg",
    scanPages: [
`Namn: Hugo Berg     Klass: NA22B
Datum: 14 maj 2026

1)  F = ma = 5·2 = 10 N  ✓

2)  v = s/t = 100/20 = 5 m/s  ✓

3)  E = mgh = 2·10·15 = 300 J  ✓

4)  3x = 12 + 6 = 18
    x = 6  ✓

5)  a = F/m = 20/4 = 5  (enhet saknas)`,
`6)  Ek = ½mv = ½·3·4 = 6 J  (glömde ² på v)

7)  W = F/s = 50/8 = 6,25  (fel formel)

8)  p = mv = 6·5 = 30 kg·m/s  ✓

9)  ρ = m/V = 500/100 = 5 g/cm³  ✓

10) P = W/t = 600/3 = 200 W  ✓`,
    ],
    steps: [
      { id: "s1-008", label: "Uppgift 1", studentAnswer: "F = 10 N", correctAnswer: "F = 10 N", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s2-008", label: "Uppgift 2", studentAnswer: "v = 5 m/s", correctAnswer: "v = 5 m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s3-008", label: "Uppgift 3", studentAnswer: "E = 300 J", correctAnswer: "E = 300 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Perfekt!" },
      { id: "s4-008", label: "Uppgift 4", studentAnswer: "x = 6", correctAnswer: "x = 6", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt!" },
      { id: "s5-008", label: "Uppgift 5", studentAnswer: "a = 5 (enhet saknas)", correctAnswer: "a = 5 m/s²", pointsBase: 1.75, pointsMax: 2, verdict: "partial", aiFeedback: "Rätt beräkning men enheten m/s² saknas. Kom ihåg att alltid ange enhet. –0,25p avdrag." },
      { id: "s6-008", label: "Uppgift 6", studentAnswer: "Ek = ½·3·4 = 6 J", correctAnswer: "Ek = 24 J", pointsBase: 0, pointsMax: 3, verdict: "incorrect", aiFeedback: "Du glömde kvadrera v. Det ska vara v² = 4² = 16. Ek = ½·3·16 = 24 J. Formeln är ½mv², inte ½mv." },
      { id: "s7-008", label: "Uppgift 7", studentAnswer: "W = 50/8 = 6,25", correctAnswer: "W = 400 J", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel formel. W = F · s (multiplikation), inte division. W = 50·8 = 400 J. Arbete beräknas alltid som kraft gånger förflyttning." },
      { id: "s8-008", label: "Uppgift 8", studentAnswer: "p = 30 kg·m/s", correctAnswer: "p = 30 kg·m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt!" },
      { id: "s9-008", label: "Uppgift 9", studentAnswer: "ρ = 5 g/cm³", correctAnswer: "ρ = 5 g/cm³", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Perfekt!" },
      { id: "s10-008", label: "Uppgift 10", studentAnswer: "P = 200 W", correctAnswer: "P = 200 W", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
    ],
  },
  {
    studentId: "mek9",
    studentName: "Alma Eriksson",
    scanPages: [
`Namn: Alma Eriksson     Klass: NA22B
Datum: 14 maj 2026

1)  F = m·a = 5·2 = 10 N  ✓
2)  v = s/t = 100/20 = 5 m/s  ✓
3)  E = mgh = 2·10·15 = 300 J  ✓
4)  3x-6=12 → 3x=18 → x=6  ✓
5)  a = F/m = 20/4 = 5 m/s²  ✓`,
`6)  Ek = ½·m·v² = ½·3·4² = ½·3·16 = 24 J  ✓
7)  W = F·s = 50·8 = 400 J  ✓
8)  p = m·v = 6·5 = 30 kg·m/s  ✓
9)  ρ = m/V = 500g/100cm³ = 5 g/cm³  ✓
10) P = W/t = 600J/3s = 200 W  ✓

Totalt: 23p — Nöjd med provet!`,
    ],
    steps: [
      { id: "s1-009", label: "Uppgift 1", studentAnswer: "F = 10 N", correctAnswer: "F = 10 N", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Perfekt lösning!" },
      { id: "s2-009", label: "Uppgift 2", studentAnswer: "v = 5 m/s", correctAnswer: "v = 5 m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s3-009", label: "Uppgift 3", studentAnswer: "E = 300 J", correctAnswer: "E = 300 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Utmärkt!" },
      { id: "s4-009", label: "Uppgift 4", studentAnswer: "x = 6", correctAnswer: "x = 6", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt!" },
      { id: "s5-009", label: "Uppgift 5", studentAnswer: "a = 5 m/s²", correctAnswer: "a = 5 m/s²", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s6-009", label: "Uppgift 6", studentAnswer: "Ek = ½·3·16 = 24 J", correctAnswer: "Ek = 24 J", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Perfekt! Tydliga steg med v² korrekt hanterat." },
      { id: "s7-009", label: "Uppgift 7", studentAnswer: "W = 400 J", correctAnswer: "W = 400 J", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt!" },
      { id: "s8-009", label: "Uppgift 8", studentAnswer: "p = 30 kg·m/s", correctAnswer: "p = 30 kg·m/s", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Korrekt med rätt enhet!" },
      { id: "s9-009", label: "Uppgift 9", studentAnswer: "ρ = 5 g/cm³", correctAnswer: "ρ = 5 g/cm³", pointsBase: 3, pointsMax: 3, verdict: "correct", aiFeedback: "Utmärkt hantering av enheter!" },
      { id: "s10-009", label: "Uppgift 10", studentAnswer: "P = 200 W", correctAnswer: "P = 200 W", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Perfekt!" },
    ],
  },
  {
    studentId: "mek10",
    studentName: "Lucas Holm",
    scanPages: [
`Namn: Lucas Holm     Klass: NA22B
Datum: 14 maj 2026

1)  F = ma = 5·2 = 10 N  ✓

2)  v = s + t = 100 + 20 = 120  (fel formel)

3)  E = m·h = 2·15 = 30  (glömde g)

4)  3x = 12
    x = 4  (glömde +6)

5)  a = F + m = 20 + 4 = 24  (fel formel)`,
`6)  Ek = m·v = 3·4 = 12  (fel formel)

7)  W = F·s = 50·8 = 400 J  ✓

8)  p = m + v = 6 + 5 = 11  (fel)

9)  ρ = V/m = 100/500 = 0,2  (omvänd formel)

10) P = t/W = 3/600 = 0,005  (omvänd formel)`,
    ],
    steps: [
      { id: "s1-010", label: "Uppgift 1", studentAnswer: "F = 10 N", correctAnswer: "F = 10 N", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Bra jobbat på uppgift 1!" },
      { id: "s2-010", label: "Uppgift 2", studentAnswer: "v = 100 + 20 = 120", correctAnswer: "v = 5 m/s", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel formel. v = s/t (division). v = 100/20 = 5 m/s. Hastighet är sträcka per tid, inte summan av dem." },
      { id: "s3-010", label: "Uppgift 3", studentAnswer: "E = m·h = 30", correctAnswer: "E = 300 J", pointsBase: 0, pointsMax: 3, verdict: "incorrect", aiFeedback: "Du glömde gravitationskonstanten g = 10 m/s². E = m·g·h = 2·10·15 = 300 J. Alla tre faktorer måste vara med." },
      { id: "s4-010", label: "Uppgift 4", studentAnswer: "x = 4", correctAnswer: "x = 6", pointsBase: 1, pointsMax: 2, verdict: "partial", aiFeedback: "Nästan rätt ansats men du glömde hantera -6. 3x – 6 = 12 → 3x = 18 → x = 6. Flytta -6 till höger sida och ändra tecken." },
      { id: "s5-010", label: "Uppgift 5", studentAnswer: "a = 20 + 4 = 24", correctAnswer: "a = 5 m/s²", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel formel. a = F/m (division). a = 20/4 = 5 m/s². Newtons andra lag: F = ma, alltså a = F/m." },
      { id: "s6-010", label: "Uppgift 6", studentAnswer: "Ek = m·v = 12", correctAnswer: "Ek = 24 J", pointsBase: 0, pointsMax: 3, verdict: "incorrect", aiFeedback: "Fel formel. Ek = ½·m·v². Du glömde kvadrera v och halvera. Ek = ½·3·4² = ½·3·16 = 24 J." },
      { id: "s7-010", label: "Uppgift 7", studentAnswer: "W = 50·8 = 400 J", correctAnswer: "W = 400 J", pointsBase: 2, pointsMax: 2, verdict: "correct", aiFeedback: "Rätt! Bra jobbat!" },
      { id: "s8-010", label: "Uppgift 8", studentAnswer: "p = 6 + 5 = 11", correctAnswer: "p = 30 kg·m/s", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Fel operation. p = m·v (multiplikation). p = 6·5 = 30 kg·m/s. Rörelsemängd är massa gånger hastighet." },
      { id: "s9-010", label: "Uppgift 9", studentAnswer: "ρ = V/m = 0,2", correctAnswer: "ρ = 5 g/cm³", pointsBase: 0, pointsMax: 3, verdict: "incorrect", aiFeedback: "Omvänd formel. Det är massa DIVIDERAT med volym, inte tvärtom. ρ = m/V = 500/100 = 5 g/cm³." },
      { id: "s10-010", label: "Uppgift 10", studentAnswer: "P = t/W = 0,005", correctAnswer: "P = 200 W", pointsBase: 0, pointsMax: 2, verdict: "incorrect", aiFeedback: "Omvänd formel. P = W/t (arbete dividerat med tid). P = 600/3 = 200 W. Du delade tid med arbete istället." },
    ],
  },
];

// Injicera i DEMO_KLASSER / DEMO_PROV / DEMO_RESULTS så att URL:en
// /classes/na22b-fysik2/grade/fysik2-prov1 blir fullt av data.
(() => {
  const klass = DEMO_KLASSER.find((k) => k.id === "na22b-fysik2");
  const prov = DEMO_PROV.find((p) => p.id === "fysik2-prov1");
  if (!klass || !prov) return;

  // Uppdatera provet till Mekanikprovet
  prov.title = "Mekanikprov – Kapitel 3";
  prov.date = "2026-05-14";
  prov.maxPoints = 23;
  prov.status = "review";
  prov.facit = MEK_FACIT;
  prov.questions = MEK_QUESTIONS;

  // Lägg till de 10 mock-eleverna i klasslistan (behåller de 25 originalen)
  for (const s of MEK_STUDENTS) {
    if (!klass.students.some((x) => x.id === s.studentId)) {
      klass.students.push({ id: s.studentId, name: s.studentName, identifier: s.studentId.toUpperCase() });
    }
  }

  // Bygg StudentResult-poster
  for (const s of MEK_STUDENTS) {
    const steps: Step[] = s.steps.map((st) => ({
      id: st.id,
      questionId: st.id,
      label: st.label,
      maxPoints: st.pointsMax,
      earnedPoints: st.pointsBase,
      status: st.verdict,
      feedback: st.aiFeedback,
      studentWork: st.studentAnswer,
      correctAnswer: st.correctAnswer,
    }));
    const totalScore = steps.reduce((a, b) => a + b.earnedPoints, 0);
    const maxScore = steps.reduce((a, b) => a + b.maxPoints, 0);
    const percentage = maxScore ? Math.round((totalScore / maxScore) * 100) : 0;
    DEMO_RESULTS.push({
      id: `mek-result-${s.studentId}`,
      provId: "fysik2-prov1",
      studentId: s.studentId,
      studentName: s.studentName,
      identificationMethod: "name_field",
      identificationConfidence: 0.97,
      steps,
      totalScore,
      maxScore,
      percentage,
      scannedAt: "2026-05-14T09:00:00Z",
      gradedAt: "2026-05-14T09:15:00Z",
      mockScanPages: [s.scanPages[0], s.scanPages[1]],
    });
  }
})();

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface StoreState {
  kurser: Kurs[];
  klasser: Klass[];
  prov: Prov[];
  results: StudentResult[];
  batchProgress: { [provId: string]: { phase: string; progress: number; total: number } };
}

// ============================================================================
// ZUSTAND STORE
// ============================================================================

export const useStore = create<StoreState>(() => ({
  kurser: DEMO_KURSER,
  klasser: DEMO_KLASSER,
  prov: DEMO_PROV,
  results: DEMO_RESULTS,
  batchProgress: {},
}));

// ============================================================================
// ACTIONS
// ============================================================================

export const actions = {
  createKlass: (data: {
    name: string;
    subject?: string;
    gradeLevel?: string;
    gradingParams?: string;
    kursId?: string;
  }): Klass => {
    const kurserState = useStore.getState().kurser;
    const customRules = (data.gradingParams || "")
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);
    const newKlass: Klass = {
      id: `klass-${Date.now()}`,
      name: data.name,
      kursId: data.kursId || kurserState[0]?.id || "",
      students: [],
      gradingParams: { ...DEFAULT_GRADING_PARAMS, customRules },
      gradeThresholds: { ...DEFAULT_GRADE_THRESHOLDS },
    };
    useStore.setState((state) => ({ klasser: [...state.klasser, newKlass] }));
    return newKlass;
  },

  updateKlassParams: (klassId: string, params: GradingParams) => {
    useStore.setState((state) => ({
      klasser: state.klasser.map((k) =>
        k.id === klassId ? { ...k, gradingParams: params } : k
      ),
    }));
  },

  startProv: (data: {
    klassId: string;
    title: string;
    date: string;
    maxPoints: number;
    facitMode: 'uploaded' | 'ai_generated' | 'none';
    facit?: string;
    customParams?: string;
  }): Prov => {
    const newProv: Prov = {
      id: `prov-${Date.now()}`,
      klassId: data.klassId,
      title: data.title,
      date: data.date,
      maxPoints: data.maxPoints,
      facitMode: data.facitMode,
      facit: data.facit,
      customParams: data.customParams,
      questions: [],
      status: "grading",
      createdAt: new Date().toISOString(),
    };
    useStore.setState((state) => ({ prov: [...state.prov, newProv] }));
    return newProv;
  },

  updateProvStatus: (provId: string, status: Prov["status"]) => {
    useStore.setState((state) => ({
      prov: state.prov.map((p) => (p.id === provId ? { ...p, status } : p)),
    }));
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
  },

  publishResults: (provId: string) => {
    useStore.setState((state) => ({
      prov: state.prov.map((p) => (p.id === provId ? { ...p, status: "published" } : p)),
    }));
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
  if (v === "incorrect") return "incorrect";
  return "pending";
}

function mapBatchToStudentResult(
  b: BatchStudentResult,
  studentId: string,
  identificationMethod: 'name_field' | 'qr_code' | 'barcode' | 'student_id',
): StudentResult {
  const steps: Step[] = b.steps.map((bs) => {
    const earned = bs.pointsTeacher ?? bs.pointsBase;
    return {
      id: bs.id,
      questionId: bs.label,
      label: bs.label,
      maxPoints: bs.pointsMax,
      earnedPoints: earned,
      status: verdictToStatus(bs.aiVerdict),
      feedback: bs.baseAnnotation,
      studentWork: bs.studentWork,
    };
  });
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

  try {
    const resp = await api.batchGrade({
      provId,
      classGradingParameters: classText,
      testSpecificParameters: customParams || '',
      answerKey,
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
