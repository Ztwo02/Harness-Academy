export type State = "unstarted" | "reading" | "completed";
export interface CatalogSource {
  projectId: string;
  repositoryId: string;
  name: string;
  url: string;
  phase: number;
  observedRef: string;
  baselineCommit: string;
}
export interface Evidence {
  path: string;
  symbol: string | null;
  startLine: number;
  endLine: number;
  blobOid: string;
  excerptSha256: string;
}
export interface Claim {
  kind: "fact" | "inference" | "advice";
  text: string;
  sourceRefs: string[];
  materialRefs?: string[];
}
export type Exercise = {
  id: string;
  prompt: string;
  explanation: Claim;
} & (
  | { kind: "single-choice"; options: { id: string; text: string }[]; correctOption: string }
  | { kind: "trace"; rubric: string[] }
);
export interface Lesson {
  id: string;
  title: string;
  objectives: string[];
  priorKnowledge: string[];
  prerequisiteLessons: string[];
  concepts: Claim[];
  sourceReading: string[];
  keySymbols: { name: string; sourceRef: string }[];
  execution: Claim[];
  calls: Claim[];
  scenario: string;
  designRationale: Claim[];
  faq: { question: string; answer: Claim }[];
  exercises: Exercise[];
  summary: Claim[];
}
export interface Course {
  schemaVersion: 1;
  projectId: string;
  repositoryId: string;
  commit: string;
  courseId: string;
  version: number;
  title: string;
  sourceEvidence: Record<string, Evidence>;
  materials: Record<
    string,
    { kind: string; url: string; accessedAt: string; sha256: string; locator: string }
  >;
  lessons: Lesson[];
}
export interface ChapterLink {
  id: string;
  title: string;
  state: State;
  prerequisiteLessons: string[];
}
export interface Edition {
  id: number;
  courseId: string;
  version: number;
  title: string;
  commit: string;
  chapters: ChapterLink[];
}
export interface Project extends CatalogSource {
  revisions: string[];
  editions: Edition[];
}
export type PublicExercise =
  | Omit<Extract<Exercise, { kind: "single-choice" }>, "correctOption" | "explanation">
  | Omit<Extract<Exercise, { kind: "trace" }>, "explanation">;
export interface ChapterPage {
  releaseId: number;
  repositoryId: string;
  projectId: string;
  commit: string;
  version: number;
  title: string;
  chapter: Omit<Lesson, "exercises"> & { exercises: PublicExercise[] };
  evidence: Record<string, Evidence>;
  materials: Course["materials"];
  state: State;
}
export interface Entry {
  id: number;
  releaseId: number;
  lessonId: string;
  lessonTitle: string;
  version: number;
  kind: "note" | "question";
  body: string;
  resolved: number;
  evidenceId: string | null;
  updatedAt: string;
}
export interface Attempt {
  id: number;
  releaseId: number;
  lessonId: string;
  lessonTitle: string;
  version: number;
  exerciseId: string;
  prompt: string;
  answer: string;
  result: "correct" | "incorrect";
  createdAt: string;
  latest: boolean;
}
export interface Review {
  entries: Entry[];
  attempts: Attempt[];
  statistics: {
    chapters: number;
    completed: number;
    exercises: number;
    attempted: number;
    firstCorrect: number;
    latestCorrect: number;
    pending: number;
    recovered: number;
    attempts: number;
    correctAttempts: number;
  };
  questions: {
    releaseId: number;
    version: number;
    lessonId: string;
    exerciseId: string;
    prompt: string;
    grading: "server" | "self";
    attempts: number;
    first: "correct" | "incorrect" | null;
    latest: "correct" | "incorrect" | null;
  }[];
}
export interface SymbolCandidate {
  path: string;
  line: number;
  column: number;
  text: string;
  kind: "definition" | "reference";
  basis: string;
}
export interface SymbolSearch {
  symbol: string;
  candidates: SymbolCandidate[];
  truncated: boolean;
  scope: string;
}
export interface TutorCard {
  lessonId: string;
  title: string;
  symbols: string[];
  responsibilities: Claim[];
  calls: Claim[];
  dataFlow: Claim[];
  scenario: string;
  questions: { question: string; answer: Claim }[];
}
export interface FileView {
  path: string;
  oid: string;
  size: number;
  content: string | null;
  reason?: string;
  lineCount: number;
}
export interface TreePage {
  entries: { name: string; path: string; kind: "tree" | "file" | "other" }[];
  next: number | null;
}
export interface Backlink {
  lessonId: string;
  title: string;
  evidenceId: string;
  startLine: number;
  endLine: number;
}
export interface ImportJob {
  id: string;
  status: "working" | "done" | "failed";
  message: string;
  releaseId?: number;
}
