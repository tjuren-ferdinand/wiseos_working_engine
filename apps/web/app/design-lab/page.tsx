"use client";

import Image from "next/image";
import { notFound } from "next/navigation";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { LOGO_MARK_DARK, LOGO_MARK_LIGHT } from "@/lib/logo";
import styles from "./design-lab.module.css";

type View = "home" | "courses" | "review";
type IconName =
  | "home"
  | "layers"
  | "review"
  | "search"
  | "plus"
  | "arrow"
  | "spark"
  | "close"
  | "more"
  | "back"
  | "moon"
  | "sun"
  | "grid"
  | "users"
  | "chart"
  | "check"
  | "trash";
type Course = {
  id: string;
  code: string;
  name: string;
  term: string;
  classes: number;
  students: number;
  progress: number;
};
type ReviewStudent = {
  name: string;
  score: number;
  maxScore: number;
  state: "ready" | "review";
  issue: string;
  confidence: number;
  question: string;
  work: string;
  analysis: string;
  points: number;
  maxPoints: number;
};
type GradingStudent = {
  id: string;
  name: string;
  state: "queued" | "working" | "done" | "review";
  score: number;
  maxScore: number;
};

const INITIAL_COURSES: Course[] = [
  {
    id: "math",
    code: "MATMAT01C",
    name: "Matematik 1c",
    term: "HT 2026",
    classes: 3,
    students: 82,
    progress: 76,
  },
  {
    id: "physics",
    code: "FYSFYS01",
    name: "Fysik 1",
    term: "HT 2026",
    classes: 2,
    students: 54,
    progress: 63,
  },
  {
    id: "programming",
    code: "PRRPRR01",
    name: "Programmering 1",
    term: "HT 2026",
    classes: 1,
    students: 28,
    progress: 42,
  },
];
const CLASS_ROWS = [
  {
    id: "na24a",
    name: "NA24A",
    courseId: "math",
    students: 28,
    tests: 4,
    review: 1,
  },
  {
    id: "na24b",
    name: "NA24B",
    courseId: "math",
    students: 27,
    tests: 3,
    review: 0,
  },
  {
    id: "te24",
    name: "TE24",
    courseId: "math",
    students: 27,
    tests: 4,
    review: 2,
  },
];
const COURSE_MOCK_DATA: Record<
  string,
  {
    scores: number[][];
    names: string[];
    rows: (typeof CLASS_ROWS)[number][];
  }
> = {
  math: {
    scores: [
      [88, 74, 91, 84],
      [76, 69, 72, 79],
      [92, 86, 95, 90],
      [64, 71, 68, 74],
      [81, 78, 85, 83],
    ],
    names: ["Alva Berg", "Noah Andersson", "Mira Lind", "Elias Holm", "Lilly Sjöberg"],
    rows: CLASS_ROWS.filter((row) => row.courseId === "math"),
  },
  physics: {
    scores: [
      [82, 78, 85, 80],
      [71, 74, 69, 77],
      [88, 84, 90, 86],
    ],
    names: ["Filip Stenberg", "Lova Hedlund", "Eddie Lund"],
    rows: [
      {
        id: "te24a",
        name: "TE24A",
        courseId: "physics",
        students: 29,
        tests: 3,
        review: 0,
      },
      {
        id: "te24b",
        name: "TE24B",
        courseId: "physics",
        students: 25,
        tests: 2,
        review: 1,
      },
    ],
  },
  programming: {
    scores: [
      [95, 92, 89, 91],
      [88, 85, 87, 90],
      [78, 82, 80, 84],
      [91, 89, 93, 90],
    ],
    names: ["Saga Nyman", "Melvin Ek", "Tilda Holm", "Elliot Berg"],
    rows: [
      {
        id: "prog24",
        name: "PROG24",
        courseId: "programming",
        students: 28,
        tests: 4,
        review: 0,
      },
    ],
  },
};
const INITIAL_REVIEW: ReviewStudent[] = [
  {
    name: "Alva Berg",
    score: 18,
    maxScore: 22,
    state: "ready",
    issue: "",
    confidence: 98,
    question: "Lös ekvationen och redovisa din metod.",
    work: "2(x + 3) = 14\n2x + 6 = 14\n2x = 8\nx = 4",
    analysis:
      "Korrekt metod och slutsvar. Samtliga operationer är tydligt redovisade.",
    points: 4,
    maxPoints: 4,
  },
  {
    name: "Noah Andersson",
    score: 15,
    maxScore: 22,
    state: "review",
    issue: "Uppgift 4",
    confidence: 71,
    question: "Bestäm funktionens nollställe och visa beräkningen.",
    work: "0 = 3x - 9\n3x = 9\nx = 3",
    analysis:
      "Slutsvaret är korrekt, men motiveringen till första omskrivningen behöver lärarens kontroll.",
    points: 2,
    maxPoints: 3,
  },
  {
    name: "Mira Lind",
    score: 20,
    maxScore: 22,
    state: "ready",
    issue: "",
    confidence: 96,
    question: "Förenkla uttrycket så långt som möjligt.",
    work: "4x + 2x - 3\n= 6x - 3",
    analysis: "Uttrycket är korrekt förenklat och notation är konsekvent.",
    points: 3,
    maxPoints: 3,
  },
  {
    name: "Elias Holm",
    score: 12,
    maxScore: 22,
    state: "review",
    issue: "Uppgift 2",
    confidence: 64,
    question: "Beräkna triangelns area.",
    work: "A = b · h\nA = 8 · 5 = 40",
    analysis:
      "Formeln saknar division med två. Kontrollera om delpoäng ska ges för identifierade mått.",
    points: 1,
    maxPoints: 3,
  },
  {
    name: "Lilly Sjöberg",
    score: 17,
    maxScore: 22,
    state: "ready",
    issue: "",
    confidence: 94,
    question: "Lös olikheten och markera svaret på en tallinje.",
    work: "2x + 4 > 10\n2x > 6\nx > 3",
    analysis: "Korrekt lösning och korrekt riktning på olikhetstecknet.",
    points: 4,
    maxPoints: 4,
  },
];
const INITIAL_GRADING: GradingStudent[] = [
  { id: "alva", name: "Alva Berg", state: "done", score: 18, maxScore: 22 },
  {
    id: "noah",
    name: "Noah Andersson",
    state: "review",
    score: 15,
    maxScore: 22,
  },
  { id: "mira", name: "Mira Lind", state: "done", score: 20, maxScore: 22 },
  { id: "elias", name: "Elias Holm", state: "working", score: 0, maxScore: 22 },
  {
    id: "lilly",
    name: "Lilly Sjöberg",
    state: "done",
    score: 17,
    maxScore: 22,
  },
  { id: "otto", name: "Otto Vik", state: "queued", score: 0, maxScore: 22 },
  { id: "nora", name: "Nora Ek", state: "done", score: 16, maxScore: 22 },
  { id: "leo", name: "Leo Hall", state: "queued", score: 0, maxScore: 22 },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    home: (
      <>
        <path d="M3.5 10.5 12 3l8.5 7.5" />
        <path d="M5.5 9v11h13V9" />
        <path d="M9.5 20v-6h5v6" />
      </>
    ),
    layers: (
      <>
        <path d="m12 3-9 5 9 5 9-5-9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 16 9 5 9-5" />
      </>
    ),
    review: (
      <>
        <path d="M5 3h14v18H5z" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
        <path d="m16 16 1.5 1.5L21 14" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4.5 4.5" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m14 7 5 5-5 5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3-1.7 5.3L5 10l5.3 1.7L12 17l1.7-5.3L19 10l-5.3-1.7L12 3Z" />
        <path d="M19 3v4M17 5h4" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    more: (
      <>
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <circle cx="19" cy="12" r="1" fill="currentColor" />
      </>
    ),
    back: (
      <>
        <path d="M19 12H5" />
        <path d="m10 7-5 5 5 5" />
      </>
    ),
    moon: (
      <path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.5 8.5 0 1 0 20.5 15.2Z" />
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
    grid: (
      <>
        <rect x="4" y="4" width="6" height="6" rx="1" />
        <rect x="14" y="4" width="6" height="6" rx="1" />
        <rect x="4" y="14" width="6" height="6" rx="1" />
        <rect x="14" y="14" width="6" height="6" rx="1" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c.6-3.4 2.6-5.2 5.5-5.2s4.9 1.8 5.5 5.2" />
        <circle cx="17" cy="9" r="2" />
        <path d="M16 14c2.5.1 4 1.6 4.5 4" />
      </>
    ),
    chart: <path d="M4 20V10M10 20V5M16 20v-7M22 20H2" />,
    check: <path d="m5 12 4 4L19 6" />,
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {paths[name]}
    </svg>
  );
}
function LogoMark({ dark }: { dark: boolean }) {
  return (
    <Image
      src={dark ? LOGO_MARK_DARK : LOGO_MARK_LIGHT}
      alt=""
      width={24}
      height={24}
      className={styles.logoMark}
    />
  );
}

type ModalEntry = { id: number; close: () => void };

const modalStack: ModalEntry[] = [];
let modalId = 0;

function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const idRef = useRef(0);
  onCloseRef.current = onClose;

  useEffect(() => {
    const entry = modalStack.find((m) => m.id === idRef.current);
    if (entry) entry.close = onCloseRef.current;
  });

  useEffect(() => {
    if (!open) {
      returnFocus.current = null;
      return;
    }
    returnFocus.current = document.activeElement as HTMLElement;
    idRef.current = ++modalId;
    modalStack.push({ id: idRef.current, close: onCloseRef.current });
    const root = ref.current;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      );
    const focusTimeout = window.setTimeout(() => {
      (
        root?.querySelector<HTMLElement>("[data-autofocus]") ?? focusable()[0]
      )?.focus();
    }, 0);
    const onKey = (event: KeyboardEvent) => {
      const top = modalStack[modalStack.length - 1];
      if (!top || top.id !== idRef.current) return;
      if (event.key === "Escape") {
        event.preventDefault();
        modalStack.pop();
        top.close();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0],
        last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(focusTimeout);
      document.removeEventListener("keydown", onKey);
      const idx = modalStack.findIndex((m) => m.id === idRef.current);
      if (idx >= 0) modalStack.splice(idx, 1);
      returnFocus.current?.focus();
    };
  }, [open]);

  return ref;
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const m = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent | MediaQueryList) =>
      setMatches(e.matches);
    handler(m);
    m.addEventListener("change", handler);
    return () => m.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export default function DesignLabPage() {
  if (process.env.NEXT_PUBLIC_ENABLE_DESIGN_LAB !== "true") notFound();
  const [view, setView] = useState<View>("home");
  const [courses, setCourses] = useState(INITIAL_COURSES);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [reviewStudents, setReviewStudents] = useState(INITIAL_REVIEW);
  const [selectedStudent, setSelectedStudent] = useState(1);
  const [studioOpen, setStudioOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [gradingOpen, setGradingOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [dark, setDark] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storedTheme = localStorage.getItem("wiseos-design-lab-theme");
    setDark(
      storedTheme
        ? storedTheme === "dark"
        : window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    const storedMotion = localStorage.getItem("wiseos-design-lab-reduced-motion");
    setReducedMotion(
      storedMotion
        ? storedMotion === "true"
        : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    setThemeReady(true);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    const onClick = (event: MouseEvent) => {
      if (
        moreRef.current &&
        !moreRef.current.contains(event.target as Node)
      ) {
        setMoreOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [moreOpen]);

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? null;
  const selected = reviewStudents[selectedStudent];
  const unresolved = reviewStudents.filter(
    (student) => student.state === "review",
  ).length;
  const title = selectedCourse
    ? selectedCourse.name
    : view === "home"
      ? "Översikt"
      : view === "courses"
        ? "Kurser"
        : "Granskning";
  const toggleTheme = () =>
    setDark((current) => {
      localStorage.setItem(
        "wiseos-design-lab-theme",
        current ? "light" : "dark",
      );
      return !current;
    });
  const toggleReducedMotion = () =>
    setReducedMotion((current) => {
      localStorage.setItem(
        "wiseos-design-lab-reduced-motion",
        String(!current),
      );
      return !current;
    });
  const navigate = (next: View) => {
    setView(next);
    setSelectedCourseId(null);
    setMoreOpen(false);
  };
  const openReviewStudent = (name: string) => {
    const index = reviewStudents.findIndex((student) => student.name === name);
    if (index >= 0) setSelectedStudent(index);
    setGradingOpen(false);
    setView("review");
    setSelectedCourseId(null);
  };
  const approveSelected = (points = selected.maxPoints) => {
    const awarded = Math.max(0, Math.min(points, selected.maxPoints));
    setReviewStudents((current) =>
      current.map((student, index) =>
        index === selectedStudent
          ? {
              ...student,
              points: awarded,
              score: Math.max(
                0,
                Math.min(
                  student.maxScore,
                  student.score - student.points + awarded,
                ),
              ),
              state: "ready",
              issue: "",
            }
          : student,
      ),
    );
    setToast(`${selected.name} är godkänd i konceptet`);
  };

  return (
    <div
      className={`${styles.sandbox} ${dark ? styles.dark : ""} ${reducedMotion ? styles.reducedMotion : ""} ${themeReady ? "" : styles.themePending}`}
    >
      <aside className={styles.rail}>
        <button
          type="button"
          className={styles.logoButton}
          onClick={() => navigate("home")}
          aria-label="WiseOS översikt"
        >
          <LogoMark dark={dark} />
        </button>
        <nav className={styles.railNav} aria-label="Huvudnavigation">
          <RailButton
            active={view === "home" && !selectedCourse}
            icon="home"
            label="Översikt"
            onClick={() => navigate("home")}
          />
          <RailButton
            active={view === "courses" || Boolean(selectedCourse)}
            icon="layers"
            label="Kurser"
            onClick={() => navigate("courses")}
          />
          <RailButton
            active={view === "review"}
            icon="review"
            label="Granska"
            count={unresolved || undefined}
            onClick={() => navigate("review")}
          />
        </nav>
        <button
          type="button"
          className={styles.avatar}
          onClick={() => setToast("Profilmenyn är simulerad i Design Lab")}
          aria-label="Öppna profilmeny"
        >
          S
        </button>
      </aside>
      <section className={styles.workspace}>
        <header className={styles.topbar}>
          <div className={styles.location}>
            {selectedCourse && (
              <button
                type="button"
                className={styles.backButton}
                onClick={() => setSelectedCourseId(null)}
                aria-label="Till kurslistan"
              >
                <Icon name="back" size={16} />
              </button>
            )}
            <span>WiseOS</span>
            <i>/</i>
            <strong>{title}</strong>
          </div>
          <div className={styles.topActions}>
            <span className={styles.labLabel}>Koncept 03</span>
            <button
              type="button"
              className={styles.commandButton}
              onClick={() => setCommandOpen(true)}
              aria-expanded={commandOpen}
              aria-haspopup="dialog"
            >
              <Icon name="search" size={15} />
              <span>Sök eller kör ett kommando</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={toggleTheme}
              aria-pressed={dark}
              aria-label={dark ? "Använd ljust tema" : "Använd mörkt tema"}
            >
              <Icon name={dark ? "sun" : "moon"} size={16} />
            </button>
            <div className={styles.moreWrap} ref={moreRef}>
              <button
                type="button"
                className={styles.iconButton}
                onClick={() => setMoreOpen((open) => !open)}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                aria-label="Fler alternativ"
              >
                <Icon name="more" />
              </button>
              {moreOpen && (
                <div className={styles.moreMenu} role="menu">
                  <button
                    type="button"
                    onClick={() => setToast("All data här är lokal mockdata")}
                  >
                    Om konceptet
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setToast("Design Lab använder ingen backend")
                    }
                  >
                    Kontrollera isolering
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      setSettingsOpen(true);
                    }}
                  >
                    Inställningar
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className={styles.content}>
          {view === "home" && !selectedCourse && (
            <HomeView
              unresolved={unresolved}
              onReview={() => navigate("review")}
              onCourse={() => {
                setView("courses");
                setSelectedCourseId("math");
              }}
              onStudio={() => setStudioOpen(true)}
            />
          )}
          {view === "courses" && !selectedCourse && (
            <CoursesView
              courses={courses}
              onSelect={(course) => setSelectedCourseId(course.id)}
              onCreate={() => setCourseDialogOpen(true)}
            />
          )}
          {selectedCourse && (
            <CourseView
              course={selectedCourse}
              onStudio={() => setStudioOpen(true)}
              onClass={() =>
                setToast("Klassarbetsytan ingår i nästa konceptnivå")
              }
            />
          )}
          {view === "review" && !selectedCourse && (
            <ReviewView
              students={reviewStudents}
              selected={selectedStudent}
              onSelect={setSelectedStudent}
              published={published}
              onPublish={() => {
                setPublished(true);
                setToast("Resultaten är publicerade lokalt i konceptet");
              }}
              onApprove={approveSelected}
            />
          )}
        </main>
      </section>
      {toast && (
        <div className={styles.toast} role="status">
          <Icon name="check" size={15} />
          {toast}
        </div>
      )}
      {courseDialogOpen && (
        <CourseDialog
          open={courseDialogOpen}
          dark={dark}
          onClose={() => setCourseDialogOpen(false)}
          onCreate={(course) => {
            setCourses((current) => [...current, course]);
            setCourseDialogOpen(false);
            setSelectedCourseId(course.id);
            setToast("Kursen skapades lokalt i konceptet");
          }}
        />
      )}
      {studioOpen && (
        <Studio
          open={studioOpen}
          dark={dark}
          courses={courses}
          onClose={() => setStudioOpen(false)}
          onStart={() => {
            setStudioOpen(false);
            setGradingOpen(true);
          }}
        />
      )}
      {gradingOpen && (
        <GradingCanvas
          dark={dark}
          onToggleTheme={toggleTheme}
          onClose={() => setGradingOpen(false)}
          onOpenStudent={openReviewStudent}
        />
      )}
      {commandOpen && (
        <CommandMenu
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          onNavigate={(next) => {
            navigate(next);
            setCommandOpen(false);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          open={settingsOpen}
          dark={dark}
          reducedMotion={reducedMotion}
          onClose={() => setSettingsOpen(false)}
          onToggleTheme={toggleTheme}
          onToggleReducedMotion={toggleReducedMotion}
        />
      )}
    </div>
  );
}

function RailButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: IconName;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.railButton} ${active ? styles.railActive : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      data-tooltip={label}
    >
      <Icon name={icon} />
      {count ? <span>{count}</span> : null}
    </button>
  );
}
function SectionHead({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className={styles.sectionHead}>
      <h2>{title}</h2>
      {action && (
        <button type="button" onClick={onAction}>
          {action}
          <Icon name="arrow" size={13} />
        </button>
      )}
    </div>
  );
}

function HomeView({
  unresolved,
  onReview,
  onCourse,
  onStudio,
}: {
  unresolved: number;
  onReview: () => void;
  onCourse: () => void;
  onStudio: () => void;
}) {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Måndag, 7 september</p>
          <h1>God eftermiddag, Simon.</h1>
          <p className={styles.lead}>
            {unresolved
              ? `${unresolved} rättningar behöver ditt omdöme.`
              : "Alla rättningar är klara."}{" "}
            Resten är under kontroll.
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onStudio}
        >
          <Icon name="plus" size={16} />
          Rätta nytt prov
        </button>
      </section>
      <section className={styles.signalRow}>
        <button type="button" className={styles.priority} onClick={onReview}>
          <span className={styles.signalDot} />
          <div>
            <small>Nästa steg</small>
            <strong>Granska Kapitelprov 3</strong>
            <p>{unresolved} elevsvar markerade · cirka 4 minuter</p>
          </div>
          <Icon name="arrow" size={17} />
        </button>
        <div className={styles.metrics}>
          <div>
            <strong>4,2 h</strong>
            <span>sparad tid</span>
          </div>
          <div>
            <strong>93%</strong>
            <span>färdiga svar</span>
          </div>
          <div>
            <strong>164</strong>
            <span>rättade i veckan</span>
          </div>
        </div>
      </section>
      <div className={styles.dashboardGrid}>
        <section>
          <SectionHead
            title="Aktiva klasser"
            action="Visa alla"
            onAction={onCourse}
          />
          <div className={styles.cleanList}>
            {CLASS_ROWS.map((row) => (
              <button
                type="button"
                key={row.id}
                className={styles.classRow}
                onClick={onCourse}
              >
                <span className={styles.classMonogram}>
                  {row.name.slice(0, 2)}
                </span>
                <span className={styles.rowMain}>
                  <strong>{row.name}</strong>
                  <small>Matematik 1c · {row.students} elever</small>
                </span>
                <span className={styles.rowMeta}>{row.tests} prov</span>
                <span
                  className={row.review ? styles.reviewCount : styles.quiet}
                >
                  {row.review ? `${row.review} väntar` : "Klart"}
                </span>
                <Icon name="arrow" size={15} />
              </button>
            ))}
          </div>
        </section>
        <aside className={styles.timeline}>
          <SectionHead title="Idag" />
          <div className={styles.timelineItem}>
            <time>17:42</time>
            <span />
            <div>
              <strong>28 prov färdigrättade</strong>
              <p>NA24A · Kapitelprov 3</p>
            </div>
          </div>
          <div className={styles.timelineItem}>
            <time>15:18</time>
            <span />
            <div>
              <strong>Resultat publicerade</strong>
              <p>TE24 · Diagnos algebra</p>
            </div>
          </div>
          <div className={styles.timelineItem}>
            <time>09:06</time>
            <span />
            <div>
              <strong>Ny klass importerad</strong>
              <p>NA24B · 27 elever</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
function CoursesView({
  courses,
  onSelect,
  onCreate,
}: {
  courses: Course[];
  onSelect: (course: Course) => void;
  onCreate: () => void;
}) {
  return (
    <div className={styles.page}>
      <section className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>Arbetsytor</p>
          <h1>Kurser</h1>
          <p className={styles.lead}>
            Samlad progression, klasser och bedömningsunderlag.
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onCreate}
        >
          <Icon name="plus" size={16} />
          Ny kurs
        </button>
      </section>
      <div className={styles.courseTable}>
        <div className={styles.tableHeader}>
          <span>Kurs</span>
          <span>Klasser</span>
          <span>Elever</span>
          <span>Progression</span>
          <span />
        </div>
        {courses.map((course) => (
          <button
            type="button"
            key={course.id}
            className={styles.courseRow}
            onClick={() => onSelect(course)}
          >
            <span className={styles.courseIdentity}>
              <small>{course.code}</small>
              <strong>{course.name}</strong>
              <em>{course.term}</em>
            </span>
            <span>{course.classes}</span>
            <span>{course.students}</span>
            <span className={styles.progressCell}>
              <i>
                <b style={{ width: `${course.progress}%` }} />
              </i>
              <small>{course.progress}%</small>
            </span>
            <Icon name="arrow" size={16} />
          </button>
        ))}
      </div>
      <p className={styles.tableNote}>
        Visar pågående kurser · all data i denna vy är simulerad
      </p>
    </div>
  );
}
function CourseView({
  course,
  onStudio,
  onClass,
}: {
  course: Course;
  onStudio: () => void;
  onClass: () => void;
}) {
  const data = COURSE_MOCK_DATA[course.id] ?? COURSE_MOCK_DATA.math;
  const { scores, names, rows } = data;
  return (
    <div className={styles.page}>
      <section className={styles.courseHero}>
        <div>
          <p className={styles.eyebrow}>
            {course.code} · {course.term}
          </p>
          <h1>{course.name}</h1>
          <p className={styles.lead}>
            {course.classes}{" "}
            {course.classes === 1 ? "klass följer" : "klasser följer"} samma
            planering och bedömningsmatris.
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={onStudio}
        >
          <Icon name="plus" size={16} />
          Rätta prov
        </button>
      </section>
      <div className={styles.courseFacts}>
        <div>
          <strong>{course.classes}</strong>
          <span>klasser</span>
        </div>
        <div>
          <strong>{course.students}</strong>
          <span>elever</span>
        </div>
        <div>
          <strong>{Math.max(course.classes * 3, 1)}</strong>
          <span>genomförda prov</span>
        </div>
        <div>
          <strong>{course.progress}%</strong>
          <span>samlad progression</span>
        </div>
      </div>
      <div className={styles.courseLayout}>
        <section>
          <SectionHead
            title="Elevprogression"
            action="Exportera"
            onAction={() => window.print()}
          />
          <div className={styles.matrix}>
            <div className={styles.matrixHead}>
              <span>Elev</span>
              <span>Diagnos</span>
              <span>Prov 1</span>
              <span>Prov 2</span>
              <span>Prov 3</span>
              <span>Trend</span>
            </div>
            {names.map((name, index) => (
              <div className={styles.matrixRow} key={name}>
                <strong>{name}</strong>
                {scores[index].map((score, i) => (
                  <span key={i} className={score < 70 ? styles.lowScore : ""}>
                    {score}%
                  </span>
                ))}
                <em>{index === 3 ? "↗" : "→"}</em>
              </div>
            ))}
          </div>
        </section>
        <aside className={styles.courseAside}>
          <SectionHead title="Klasser" />
          {rows.slice(0, course.classes).map((row) => (
            <button type="button" key={row.id} onClick={onClass}>
              <span>
                <strong>{row.name}</strong>
                <small>
                  {row.students} elever · {row.tests} prov
                </small>
              </span>
              <Icon name="arrow" size={15} />
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}
function ReviewView({
  students,
  selected,
  onSelect,
  published,
  onPublish,
  onApprove,
}: {
  students: ReviewStudent[];
  selected: number;
  onSelect: (index: number) => void;
  published: boolean;
  onPublish: () => void;
  onApprove: (points?: number) => void;
}) {
  const student = students[selected],
    unresolved = students.filter((item) => item.state === "review").length,
    percent = Math.round((student.score / student.maxScore) * 100);
  const [editing, setEditing] = useState(false);
  const [points, setPoints] = useState(student.points);
  useEffect(() => {
    setEditing(false);
    setPoints(student.points);
  }, [student]);
  return (
    <div className={styles.reviewPage}>
      <header className={styles.reviewHeader}>
        <div>
          <p className={styles.eyebrow}>NA24A · Matematik 1c</p>
          <h1>Kapitelprov 3</h1>
          <p>
            {students.length - unresolved} av {students.length} svar klara för
            publicering
          </p>
        </div>
        <button
          type="button"
          className={published ? styles.publishedButton : styles.primaryButton}
          disabled={unresolved > 0 || published}
          onClick={onPublish}
        >
          {published
            ? "Publicerat"
            : unresolved
              ? `${unresolved} kontroller återstår`
              : "Publicera resultat"}
        </button>
      </header>
      <div className={styles.reviewLayout}>
        <aside className={styles.studentList} aria-label="Elevsvar">
          <div className={styles.listFilter}>
            <span>Elevsvar</span>
            <small>{unresolved} behöver kontroll</small>
          </div>
          {students.map((item, index) => (
            <button
              type="button"
              key={item.name}
              className={selected === index ? styles.studentActive : ""}
              aria-pressed={selected === index}
              onClick={() => onSelect(index)}
            >
              <span>
                <strong>{item.name}</strong>
                <small>{item.issue || "Inga avvikelser"}</small>
              </span>
              <em>{Math.round((item.score / item.maxScore) * 100)}%</em>
            </button>
          ))}
        </aside>
        <section className={styles.answerPane}>
          <div className={styles.answerTop}>
            <div>
              <small>Valt elevsvar</small>
              <h2>{student.name}</h2>
            </div>
            <div className={styles.score}>
              <strong>
                {student.score} / {student.maxScore}
              </strong>
              <span>{percent}%</span>
            </div>
          </div>
          <div className={styles.reviewBody}>
            <div className={styles.paperPreview}>
              <div className={styles.paperTop}>
                <span>Kapitelprov 3</span>
                <small>Sida 1 av 2</small>
              </div>
              <div className={styles.paperQuestion}>
                <b>4.</b>
                <p>{student.question}</p>
              </div>
              <div className={styles.handwriting}>
                {student.work.split("\n").map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </div>
              <div className={styles.paperMark}>{student.points}</div>
            </div>
            <div className={styles.analysis}>
              <div className={styles.analysisHeader}>
                <span className={styles.analysisMark}>
                  <Icon name="spark" size={15} />
                </span>
                <div>
                  <small>AI-bedömning</small>
                  <strong>
                    {student.state === "review"
                      ? "Behöver ditt omdöme"
                      : "Bedömning redo"}
                  </strong>
                </div>
                <span className={styles.confidence}>
                  {student.confidence}% säker
                </span>
              </div>
              <p>{student.analysis}</p>
              <dl>
                <div>
                  <dt>Uppgift</dt>
                  <dd>
                    {student.points} av {student.maxPoints} poäng
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{student.state === "review" ? "Kontrollera" : "Klar"}</dd>
                </div>
                <div>
                  <dt>Underlag</dt>
                  <dd>Fullständigt</dd>
                </div>
              </dl>
              {editing ? (
                <div className={styles.pointEditor}>
                  <label htmlFor="mock-points">Poäng</label>
                  <input
                    id="mock-points"
                    type="number"
                    min={0}
                    max={student.maxPoints}
                    value={points}
                    onChange={(event) => setPoints(Number(event.target.value))}
                  />
                  <span>av {student.maxPoints}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onApprove(points);
                      setEditing(false);
                    }}
                  >
                    Spara
                  </button>
                </div>
              ) : (
                <div className={styles.reviewActions}>
                  <button type="button" onClick={() => setEditing(true)}>
                    Justera
                  </button>
                  <button
                    type="button"
                    className={styles.approveButton}
                    disabled={student.state === "ready"}
                    onClick={() => onApprove()}
                  >
                    {student.state === "ready"
                      ? "Godkänd"
                      : "Godkänn bedömning"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function CourseDialog({
  open,
  dark,
  onClose,
  onCreate,
}: {
  open: boolean;
  dark: boolean;
  onClose: () => void;
  onCreate: (course: Course) => void;
}) {
  const ref = useDialog(open, onClose),
    [name, setName] = useState(""),
    [code, setCode] = useState("");
  return (
    <div className={styles.commandOverlay} onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="course-title"
        className={styles.formDialog}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <LogoMark dark={dark} />
          <button type="button" onClick={onClose} aria-label="Stäng">
            <Icon name="close" />
          </button>
        </header>
        <h2 id="course-title">Skapa kurs</h2>
        <p>Skapas endast i Design Lab och sparas inte.</p>
        <label>
          <span>Kursnamn</span>
          <input
            data-autofocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Exempelvis Matematik 2c"
          />
        </label>
        <label>
          <span>Kurskod</span>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="MATMAT02C"
          />
        </label>
        <footer>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            Avbryt
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={!name.trim()}
            onClick={() =>
              onCreate({
                id: `mock-${Date.now()}`,
                name: name.trim(),
                code: code.trim() || "EGEN KURS",
                term: "HT 2026",
                classes: 0,
                students: 0,
                progress: 0,
              })
            }
          >
            Skapa lokalt
          </button>
        </footer>
      </div>
    </div>
  );
}
function Studio({
  open,
  dark,
  courses,
  onClose,
  onStart,
}: {
  open: boolean;
  dark: boolean;
  courses: Course[];
  onClose: () => void;
  onStart: () => void;
}) {
  const ref = useDialog(open, onClose),
    fileInputRef = useRef<HTMLInputElement>(null),
    [step, setStep] = useState(0),
    [courseId, setCourseId] = useState(courses[0]?.id ?? ""),
    [title, setTitle] = useState("Kapitelprov 4"),
    [file, setFile] = useState(false);
  const canContinue =
    step === 0 ? Boolean(courseId && title.trim()) : step === 1 ? file : true;
  return (
    <div
      ref={ref}
      className={styles.studio}
      role="dialog"
      aria-modal="true"
      aria-labelledby="studio-title"
    >
      <header>
        <div className={styles.studioBrand}>
          <LogoMark dark={dark} />
          <span>Ny rättning</span>
        </div>
        <div className={styles.steps} aria-label={`Steg ${step + 1} av 3`}>
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={step >= index ? styles.stepActive : ""}
              aria-current={step === index ? "step" : undefined}
            >
              {index + 1}
            </span>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Stäng">
          <Icon name="close" />
        </button>
      </header>
      <main>
        {step === 0 && (
          <div className={styles.studioContent}>
            <p className={styles.eyebrow}>Steg 1 av 3</p>
            <h1 id="studio-title">Vad ska rättas?</h1>
            <p className={styles.lead}>
              Välj klass och ge provet ett tydligt namn.
            </p>
            <label>
              <span>Klass</span>
              <select
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code} · {course.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Provets namn</span>
              <input
                data-autofocus
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
          </div>
        )}
        {step === 1 && (
          <div className={styles.studioContent}>
            <p className={styles.eyebrow}>Steg 2 av 3</p>
            <h1 id="studio-title">Lägg till elevsvaren</h1>
            <p className={styles.lead}>
              Dra in en PDF eller flera skannade bilder.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={() => setFile(true)}
            />
            <button
              type="button"
              className={`${styles.dropzone} ${file ? styles.dropzoneReady : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                setFile(true);
              }}
            >
              {file ? (
                <>
                  <span>
                    <Icon name="check" />
                  </span>
                  <strong>28 elevsvar identifierade</strong>
                  <small>Kapitelprov_4_NA24A.pdf</small>
                </>
              ) : (
                <>
                  <span>
                    <Icon name="plus" />
                  </span>
                  <strong>Släpp filer här</strong>
                  <small>eller välj från datorn · PDF, PNG, JPG</small>
                </>
              )}
            </button>
            {file && (
              <div className={styles.fileRow}>
                <span>Kapitelprov_4_NA24A.pdf</span>
                <small>28 svar · 42,8 MB</small>
                <b>Redo</b>
                <button
                  type="button"
                  onClick={() => setFile(false)}
                  aria-label="Ta bort fil"
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            )}
          </div>
        )}
        {step === 2 && (
          <div className={styles.studioContent}>
            <p className={styles.eyebrow}>Steg 3 av 3</p>
            <h1 id="studio-title">Redo att börja</h1>
            <p className={styles.lead}>
              WiseOS delar upp bunten, identifierar elever och förbereder allt
              för din granskning.
            </p>
            <div className={styles.summary}>
              <div>
                <span>Kurs</span>
                <strong>
                  {courses.find((course) => course.id === courseId)?.name}
                </strong>
              </div>
              <div>
                <span>Prov</span>
                <strong>{title}</strong>
              </div>
              <div>
                <span>Elevsvar</span>
                <strong>28</strong>
              </div>
              <div>
                <span>Läge</span>
                <strong>Konceptsimulering</strong>
              </div>
            </div>
          </div>
        )}
      </main>
      <footer>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={step === 0 ? onClose : () => setStep(step - 1)}
        >
          {step === 0 ? "Avbryt" : "Tillbaka"}
        </button>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={!canContinue}
          onClick={step === 2 ? onStart : () => setStep(step + 1)}
        >
          {step === 2 ? "Starta simulering" : "Fortsätt"}
          <Icon name="arrow" size={15} />
        </button>
      </footer>
    </div>
  );
}

function GradingCanvas({
  dark,
  onToggleTheme,
  onClose,
  onOpenStudent,
}: {
  dark: boolean;
  onToggleTheme: () => void;
  onClose: () => void;
  onOpenStudent: (name: string) => void;
}) {
  const dialogRef = useDialog(true, onClose),
    canvasRef = useRef<HTMLDivElement>(null),
    [tool, setTool] = useState<"grid" | "users" | "chart">("grid"),
    [selected, setSelected] = useState<string | null>("noah"),
    [students, setStudents] = useState(INITIAL_GRADING),
    [layoutVersion, setLayoutVersion] = useState(0),
    isMobile = useMediaQuery("(max-width: 640px)");
  useEffect(() => {
    const timers = [
      window.setTimeout(
        () =>
          setStudents((items) =>
            items.map((item) =>
              item.id === "elias"
                ? { ...item, state: "done", score: 14 }
                : item,
            ),
          ),
        1800,
      ),
      window.setTimeout(
        () =>
          setStudents((items) =>
            items.map((item) =>
              item.id === "otto" ? { ...item, state: "working" } : item,
            ),
          ),
        2600,
      ),
      window.setTimeout(
        () =>
          setStudents((items) =>
            items.map((item) =>
              item.id === "otto" ? { ...item, state: "done", score: 19 } : item,
            ),
          ),
        4800,
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);
  const active = students.find((student) => student.id === selected),
    done = students.filter((student) => student.state === "done").length,
    reviews = students.filter((student) => student.state === "review").length,
    allDone =
      students.length > 0 && students.every((student) => student.state === "done"),
    scored = students.filter((student) => student.score > 0),
    average = scored.length
      ? Math.round(
          scored.reduce(
            (sum, item) => sum + (item.score / item.maxScore) * 100,
            0,
          ) / scored.length,
        )
      : 0;
  return (
    <div
      ref={dialogRef}
      className={styles.gradingShell}
      role="dialog"
      aria-modal="true"
      aria-label="Rättningscanvas"
    >
      <aside className={styles.gradingRail}>
        <LogoMark dark={dark} />
        <div>
          {(["grid", "users", "chart"] as const).map((name) => (
            <button
              type="button"
              key={name}
              className={tool === name ? styles.gradingToolActive : ""}
              aria-pressed={tool === name}
              onClick={() => setTool(name)}
              aria-label={
                name === "grid"
                  ? "Canvas"
                  : name === "users"
                    ? "Elevlista"
                    : "Statistik"
              }
            >
              <Icon name={name} />
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Avsluta">
          <Icon name="close" />
        </button>
      </aside>
      <section className={styles.gradingWorkspace}>
        <header className={styles.gradingTopbar}>
          <div>
            <small>NA24A · Matematik 1c</small>
            <strong>Kapitelprov 4</strong>
          </div>
          <div className={styles.gradingStatus}>
            <span />
            <div>
              <small>
                {allDone ? "Rättning klar" : "Rättar elevsvar"}
              </small>
              <strong>
                {done} av {students.length}
              </strong>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setLayoutVersion((value) => value + 1)}
          >
            Ordna om
          </button>
          <button type="button" onClick={onToggleTheme} aria-label="Växla tema">
            <Icon name={dark ? "sun" : "moon"} size={16} />
          </button>
          <button type="button" onClick={onClose}>
            Avsluta
          </button>
        </header>
        <div ref={canvasRef} className={styles.nodeCanvas}>
          <div className={styles.canvasHint}>
            Dra korten eller använd elevlistan för att navigera
          </div>
          <div className={styles.nodeGrid}>
            {students.map((student) => (
              <motion.button
                key={`${student.id}-${layoutVersion}`}
                type="button"
                drag={!isMobile}
                dragConstraints={canvasRef}
                dragMomentum={false}
                whileDrag={{ scale: 1.025, zIndex: 20 }}
                onClick={() => setSelected(student.id)}
                aria-pressed={selected === student.id}
                className={`${styles.studentNode} ${styles[`node_${student.state}`]} ${selected === student.id ? styles.nodeSelected : ""}`}
              >
                <span className={styles.nodeDot} />
                <span>
                  <strong>{student.name}</strong>
                  <small>
                    {student.state === "done"
                      ? `${student.score} / ${student.maxScore} poäng`
                      : student.state === "review"
                        ? "Behöver kontroll"
                        : student.state === "working"
                          ? "Analyserar…"
                          : "Väntar"}
                  </small>
                </span>
                {student.score > 0 && (
                  <em>
                    {Math.round((student.score / student.maxScore) * 100)}%
                  </em>
                )}
              </motion.button>
            ))}
          </div>
          {tool !== "grid" && (
            <aside className={styles.canvasPanel}>
              <header>
                <span>
                  {tool === "users" ? "Alla elevsvar" : "Klassens resultat"}
                </span>
                <button
                  type="button"
                  onClick={() => setTool("grid")}
                  aria-label="Stäng panel"
                >
                  <Icon name="close" size={14} />
                </button>
              </header>
              {tool === "users" ? (
                <div className={styles.canvasStudentList}>
                  {students.map((student) => (
                    <button
                      type="button"
                      key={student.id}
                      onClick={() => setSelected(student.id)}
                      aria-pressed={selected === student.id}
                    >
                      <span
                        className={`${styles.nodeDot} ${styles[`dot_${student.state}`]}`}
                      />
                      <strong>{student.name}</strong>
                      <small>
                        {student.score
                          ? `${Math.round((student.score / student.maxScore) * 100)}%`
                          : "—"}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <div className={styles.canvasStats}>
                  <div>
                    <strong>{average}%</strong>
                    <span>klassnitt</span>
                  </div>
                  <div>
                    <strong>{done}</strong>
                    <span>färdiga</span>
                  </div>
                  <div>
                    <strong>{reviews}</strong>
                    <span>kontroller</span>
                  </div>
                  <div
                    className={styles.miniBars}
                    aria-label="Resultatfördelning"
                  >
                    {scored.map((student) => (
                      <i
                        key={student.id}
                        style={{
                          height: `${Math.max(12, (student.score / student.maxScore) * 100)}%`,
                        }}
                        title={`${student.name}: ${Math.round((student.score / student.maxScore) * 100)}%`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </aside>
          )}
          {active && (
            <aside
              className={`${styles.nodeInspector} ${styles[`node_${active.state}`]}`}
            >
              <div className={styles.inspectorTop}>
                <span className={styles.nodeDot} />
                <div>
                  <small>Aktivt elevsvar</small>
                  <strong>{active.name}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Stäng inspektör"
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
              <div className={styles.inspectorScore}>
                <strong>
                  {active.score
                    ? `${Math.round((active.score / active.maxScore) * 100)}%`
                    : "—"}
                </strong>
                <span>
                  {active.score
                    ? `${active.score} / ${active.maxScore}`
                    : "Bearbetas"}
                </span>
              </div>
              <dl>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {active.state === "done"
                      ? "Klar"
                      : active.state === "review"
                        ? "Kontrollera"
                        : active.state === "working"
                          ? "Analyserar"
                          : "I kö"}
                  </dd>
                </div>
                <div>
                  <dt>Identifiering</dt>
                  <dd>98% säker</dd>
                </div>
                <div>
                  <dt>Uppgifter</dt>
                  <dd>{active.score ? "6 av 6" : "—"}</dd>
                </div>
              </dl>
              <button
                type="button"
                className={styles.inspectButton}
                onClick={() => onOpenStudent(active.name)}
              >
                Öppna elevsvar <Icon name="arrow" size={14} />
              </button>
            </aside>
          )}
        </div>
      </section>
    </div>
  );
}

function CommandMenu({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (view: View) => void;
}) {
  const ref = useDialog(open, onClose),
    [query, setQuery] = useState(""),
    [active, setActive] = useState(0),
    items = [
      { view: "home" as View, label: "Översikt", icon: "home" as IconName },
      { view: "courses" as View, label: "Kurser", icon: "layers" as IconName },
      {
        view: "review" as View,
        label: "Granskning",
        icon: "review" as IconName,
      },
    ],
    filtered = items.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase()),
    );
  useEffect(() => {
    setActive((value) =>
      filtered.length ? Math.min(value, filtered.length - 1) : 0,
    );
  }, [filtered]);
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((value) =>
        filtered.length ? Math.min(value + 1, filtered.length - 1) : 0,
      );
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((value) => (filtered.length ? Math.max(value - 1, 0) : 0));
    }
    if (event.key === "Enter" && filtered[active]) {
      onNavigate(filtered[active].view);
    }
  };
  return (
    <div className={styles.commandOverlay} onMouseDown={onClose}>
      <div
        ref={ref}
        className={styles.commandMenu}
        role="dialog"
        aria-modal="true"
        aria-label="Kommandomeny"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className={styles.commandInput}>
          <Icon name="search" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Sök i WiseOS…"
            aria-label="Sök kommando"
          />
        </div>
        <small>Gå till</small>
        {filtered.map((item, index) => (
          <button
            type="button"
            key={item.view}
            className={active === index ? styles.commandActive : ""}
            onMouseEnter={() => setActive(index)}
            onClick={() => onNavigate(item.view)}
          >
            <Icon name={item.icon} />
            <span>{item.label}</span>
            <kbd>↵</kbd>
          </button>
        ))}
        {!filtered.length && (
          <p className={styles.noCommands}>Inga kommandon hittades</p>
        )}
      </div>
    </div>
  );
}

function SettingsDialog({
  open,
  dark,
  reducedMotion,
  onClose,
  onToggleTheme,
  onToggleReducedMotion,
}: {
  open: boolean;
  dark: boolean;
  reducedMotion: boolean;
  onClose: () => void;
  onToggleTheme: () => void;
  onToggleReducedMotion: () => void;
}) {
  const ref = useDialog(open, onClose);
  return (
    <div className={styles.commandOverlay} onMouseDown={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className={`${styles.formDialog} ${styles.settingsDialog}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <LogoMark dark={dark} />
          <button type="button" onClick={onClose} aria-label="Stäng">
            <Icon name="close" />
          </button>
        </header>
        <h2 id="settings-title">Inställningar</h2>
        <p>Alla ändringar gäller endast Design Lab och sparas lokalt.</p>
        <div className={styles.settingsRow}>
          <span>
            <strong>Tema</strong>
            <small>{dark ? "Mörkt läge" : "Ljust läge"}</small>
          </span>
          <button
            type="button"
            className={styles.toggleButton}
            aria-pressed={dark}
            onClick={onToggleTheme}
          >
            <Icon name={dark ? "sun" : "moon"} size={15} />
            {dark ? "Ljust" : "Mörkt"}
          </button>
        </div>
        <div className={styles.settingsRow}>
          <span>
            <strong>Reducerad rörelse</strong>
            <small>{reducedMotion ? "På" : "Av"}</small>
          </span>
          <button
            type="button"
            className={styles.toggleButton}
            aria-pressed={reducedMotion}
            onClick={onToggleReducedMotion}
          >
            {reducedMotion ? "På" : "Av"}
          </button>
        </div>
        <div className={styles.settingsRow}>
          <span>
            <strong>Språk</strong>
            <small>Svenska</small>
          </span>
          <button type="button" className={styles.toggleButton} disabled>
            Svenska
          </button>
        </div>
      </div>
    </div>
  );
}
