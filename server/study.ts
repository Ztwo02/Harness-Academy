import type { DatabaseSync } from "node:sqlite";
import type {
  Attempt,
  CatalogSource,
  ChapterPage,
  Course,
  Entry,
  Project,
  Review,
  State,
} from "../shared/types.ts";
import { requireThat, transaction } from "./base.ts";
import { getLesson, getRelease } from "./courses.ts";

export function projects(db: DatabaseSync, sources: CatalogSource[]): Project[] {
  return sources.map((source) => {
    const releases = db
      .prepare(
        "SELECT id,document FROM course_release WHERE project_id=? ORDER BY course_id,version DESC",
      )
      .all(source.projectId);
    return {
      ...source,
      revisions: db
        .prepare("SELECT commit_sha FROM revision WHERE repository_id=? ORDER BY pinned_at DESC")
        .all(source.repositoryId)
        .map((x) => String(x.commit_sha)),
      editions: releases.map((r) => {
        const course = JSON.parse(String(r.document)) as Course;
        const states = new Map(
          db
            .prepare("SELECT lesson_id,state FROM lesson_progress WHERE release_id=?")
            .all(r.id)
            .map((x) => [x.lesson_id, x.state]),
        );
        return {
          id: Number(r.id),
          courseId: course.courseId,
          version: course.version,
          commit: course.commit,
          title: course.title,
          chapters: course.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            prerequisiteLessons: l.prerequisiteLessons,
            state: (states.get(l.id) ?? "unstarted") as State,
          })),
        };
      }),
    };
  });
}
export function chapterPage(db: DatabaseSync, releaseId: number, lessonId: string): ChapterPage {
  const course = getRelease(db, releaseId),
    lesson = getLesson(course, lessonId);
  const state = db
    .prepare("SELECT state FROM lesson_progress WHERE release_id=? AND lesson_id=?")
    .get(releaseId, lessonId);
  return {
    releaseId,
    repositoryId: course.repositoryId,
    projectId: course.projectId,
    commit: course.commit,
    version: course.version,
    title: course.title,
    evidence: course.sourceEvidence,
    materials: course.materials,
    state: (state?.state ?? "unstarted") as State,
    chapter: {
      ...lesson,
      exercises: lesson.exercises.map((q) =>
        q.kind === "single-choice"
          ? { id: q.id, kind: q.kind, prompt: q.prompt, options: q.options }
          : { id: q.id, kind: q.kind, prompt: q.prompt, rubric: q.rubric },
      ),
    },
  };
}

export interface Answer {
  releaseId: number;
  lessonId: string;
  exerciseId: string;
  answer: string;
  requestId: string;
  selfGrade?: "correct" | "incorrect";
}
export function recordAnswer(db: DatabaseSync, body: Answer) {
  const course = getRelease(db, body.releaseId),
    lesson = getLesson(course, body.lessonId);
  const q = lesson.exercises.find((x) => x.id === body.exerciseId);
  requireThat(q, 404, "exercise", "当前章节找不到这道题。");
  let result: "correct" | "incorrect";
  if (q.kind === "single-choice") {
    requireThat(
      q.options.some((x) => x.id === body.answer) && !body.selfGrade,
      400,
      "option",
      "请选择该题的一个选项。",
    );
    result = q.correctOption === body.answer ? "correct" : "incorrect";
  } else {
    requireThat(body.selfGrade, 400, "grade", "请对照评分点自评。");
    result = body.selfGrade;
  }
  return transaction(db, () => {
    const row = db.prepare("SELECT * FROM attempt WHERE request_id=?").get(body.requestId);
    if (row) {
      requireThat(
        row.release_id === body.releaseId &&
          row.lesson_id === body.lessonId &&
          row.exercise_id === body.exerciseId &&
          row.answer === body.answer &&
          row.result === result,
        409,
        "attempt_conflict",
        "该请求号已有另一份作答，请重新提交。",
      );
    } else {
      db.prepare(
        "INSERT INTO attempt(request_id,release_id,lesson_id,exercise_id,answer,result) VALUES (?,?,?,?,?,?)",
      ).run(body.requestId, body.releaseId, body.lessonId, body.exerciseId, body.answer, result);
    }
    return { result, explanation: q.explanation };
  });
}
export function review(db: DatabaseSync, releaseId?: number, projectId?: string): Review {
  const clause = " WHERE (? IS NULL OR r.id=?) AND (? IS NULL OR r.project_id=?)";
  const filters = [releaseId ?? null, releaseId ?? null, projectId ?? null, projectId ?? null];
  const entries = db
    .prepare(
      `SELECT e.id,e.release_id releaseId,e.lesson_id lessonId,l.title lessonTitle,r.version,
    e.kind,e.body,e.resolved,e.evidence_id evidenceId,e.updated_at updatedAt FROM learning_entry e
    JOIN course_release r ON r.id=e.release_id JOIN lesson l ON l.release_id=r.id AND l.id=e.lesson_id` +
        clause +
        " ORDER BY e.updated_at DESC,e.id DESC",
    )
    .all(...filters) as unknown as Entry[];
  const rows = db
    .prepare(
      `SELECT a.id,a.release_id releaseId,a.lesson_id lessonId,l.title lessonTitle,r.version,
    a.exercise_id exerciseId,a.answer,a.result,a.created_at createdAt FROM attempt a
    JOIN course_release r ON r.id=a.release_id JOIN lesson l ON l.release_id=r.id AND l.id=a.lesson_id` +
        clause +
        " ORDER BY a.id DESC",
    )
    .all(...filters);
  const cache = new Map<number, Course>(),
    seen = new Set<string>();
  const attempts = rows.map((row) => {
    const item = row as unknown as Attempt;
    const course = cache.get(item.releaseId) ?? getRelease(db, item.releaseId);
    cache.set(item.releaseId, course);
    const q = getLesson(course, item.lessonId).exercises.find((x) => x.id === item.exerciseId)!;
    const key = JSON.stringify([item.releaseId, item.lessonId, item.exerciseId]);
    const latest = !seen.has(key);
    seen.add(key);
    return {
      ...item,
      latest,
      prompt: q.prompt,
      answer:
        q.kind === "single-choice"
          ? (q.options.find((x) => x.id === item.answer)?.text ?? item.answer)
          : item.answer,
    };
  });
  const releases = db
    .prepare("SELECT r.id,r.document FROM course_release r" + clause)
    .all(...filters);
  const statistics: Review["statistics"] = {
    chapters: 0,
    completed: 0,
    exercises: 0,
    attempted: 0,
    firstCorrect: 0,
    latestCorrect: 0,
    pending: 0,
    recovered: 0,
    attempts: attempts.length,
    correctAttempts: attempts.filter((a) => a.result === "correct").length,
  };
  const questions: Review["questions"] = [];
  const groups = new Map<string, Attempt[]>();
  for (const a of attempts) {
    const key = JSON.stringify([a.releaseId, a.lessonId, a.exerciseId]);
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  for (const row of releases) {
    const course = JSON.parse(String(row.document)) as Course;
    statistics.chapters += course.lessons.length;
    statistics.completed += Number(
      db
        .prepare("SELECT count(*) n FROM lesson_progress WHERE release_id=? AND state='completed'")
        .get(row.id)?.n,
    );
    for (const lesson of course.lessons)
      for (const q of lesson.exercises) {
        const answers = groups.get(JSON.stringify([Number(row.id), lesson.id, q.id])) ?? [];
        const first = answers.at(-1)?.result ?? null,
          latest = answers[0]?.result ?? null;
        questions.push({
          releaseId: Number(row.id),
          version: course.version,
          lessonId: lesson.id,
          exerciseId: q.id,
          prompt: q.prompt,
          grading: q.kind === "trace" ? "self" : "server",
          attempts: answers.length,
          first,
          latest,
        });
        statistics.exercises++;
        if (answers.length) statistics.attempted++;
        if (first === "correct") statistics.firstCorrect++;
        if (latest === "correct") statistics.latestCorrect++;
        if (latest === "incorrect") statistics.pending++;
        if (first === "incorrect" && latest === "correct") statistics.recovered++;
      }
  }
  return { entries, attempts, statistics, questions };
}
