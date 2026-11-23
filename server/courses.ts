import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import type { DatabaseSync } from "node:sqlite";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { parseJson, Problem, requireThat, root, transaction } from "./base.ts";
import { readFileAt, snapshotPath, verifyExcerpt } from "./git.ts";
import type { Claim, Course, Evidence, FileView, Lesson } from "../shared/types.ts";

const ajv = new Ajv2020({ ownProperties: true });
addFormats(ajv);
const schema = JSON.parse(readFileSync(path.join(root, "docs/schema/course.schema.json"), "utf8"));
const matchesSchema = ajv.compile<Course>(schema);
export const piCourse = parseJson(
  readFileSync(path.join(root, "courses/pi-foundations.v1.json"), "utf8"),
) as Course;
export const piCourses = [
  piCourse,
  parseJson(readFileSync(path.join(root, "courses/pi-foundations.v2.json"), "utf8")) as Course,
];
export const codexCourse = parseJson(
  readFileSync(path.join(root, "courses/codex-foundations.v1.json"), "utf8"),
) as Course;
export const bundledCourses = [...piCourses, codexCourse];

export function getRelease(db: DatabaseSync, id: number) {
  const row = db.prepare("SELECT document FROM course_release WHERE id=?").get(id);
  requireThat(row, 404, "release", "找不到该课程版次，请返回学习中心。");
  return JSON.parse(String(row.document)) as Course;
}
export function getLesson(course: Course, id: string) {
  const lesson = course.lessons.find((item) => item.id === id);
  requireThat(lesson, 404, "lesson", "本版课程中没有这个章节。");
  return lesson;
}
function reviewLesson(course: Course, lesson: Lesson, previous: Set<string>) {
  const check = (value: unknown, msg: string) =>
    requireThat(value, 422, "course_reference", lesson.id + " · " + msg);
  check(!previous.has(lesson.id), "章节 ID 重复");
  for (const id of lesson.prerequisiteLessons)
    check(previous.has(id), "前置章节必须已在前面出现：" + id);
  const refs = new Set(lesson.sourceReading);
  const claims: Claim[] = [
    ...lesson.concepts,
    ...lesson.execution,
    ...lesson.calls,
    ...lesson.designRationale,
    ...lesson.summary,
    ...lesson.faq.map((x) => x.answer),
    ...lesson.exercises.map((x) => x.explanation),
  ];
  for (const claim of claims) {
    for (const id of claim.sourceRefs) refs.add(id);
    for (const id of claim.materialRefs ?? [])
      check(Object.hasOwn(course.materials, id), "缺少资料：" + id);
  }
  for (const symbol of lesson.keySymbols) {
    refs.add(symbol.sourceRef);
    check(
      Object.hasOwn(course.sourceEvidence, symbol.sourceRef) &&
        course.sourceEvidence[symbol.sourceRef].symbol === symbol.name,
      "符号与证据不匹配：" + symbol.name,
    );
  }
  for (const id of refs) check(Object.hasOwn(course.sourceEvidence, id), "未找到源码证据：" + id);
  const ids = new Set<string>();
  for (const exercise of lesson.exercises) {
    check(!ids.has(exercise.id), "题号重复：" + exercise.id);
    ids.add(exercise.id);
    if (exercise.kind === "single-choice") {
      const options = new Set(exercise.options.map((x) => x.id));
      check(
        options.size === exercise.options.length && options.has(exercise.correctOption),
        "题目选项或答案无效：" + exercise.id,
      );
    }
  }
  return refs;
}

export async function publish(db: DatabaseSync, dataDir: string, input: unknown) {
  requireThat(
    matchesSchema(input),
    422,
    "course_schema",
    "课程字段有误：" + ajv.errorsText(matchesSchema.errors),
  );
  const course = input;
  const repository = db
    .prepare("SELECT project_id,public_url FROM repository WHERE id=?")
    .get(course.repositoryId);
  requireThat(
    repository?.project_id === course.projectId,
    422,
    "repository",
    "课程项目与主仓库不匹配。",
  );
  requireThat(
    ["pi", "codex"].includes(course.projectId),
    422,
    "planned",
    "当前阶段仅开放 Pi 和 Codex 课程。",
  );
  const dir = snapshotPath(db, dataDir, course.repositoryId, course.commit);
  const ids = new Set<string>(),
    links = new Map<string, Set<string>>();
  for (const lesson of course.lessons) {
    links.set(lesson.id, reviewLesson(course, lesson, ids));
    ids.add(lesson.id);
  }
  for (const [id, material] of Object.entries(course.materials)) {
    const url = new URL(material.url);
    requireThat(
      !url.username &&
        !url.password &&
        material.url.startsWith(String(repository.public_url) + "/"),
      422,
      "material_origin",
      id + "：补充资料须来自本版登记的项目仓库。",
    );
    const bytes = await readFile(path.join(dataDir, "materials", material.sha256)).catch(
      () => null,
    );
    requireThat(
      bytes &&
        createHash("sha256").update(bytes).digest("hex") === material.sha256 &&
        bytes.toString("utf8").includes(material.locator),
      422,
      "material_snapshot",
      id + "：缺少已核验的本地资料快照或段落。",
    );
  }
  const files = new Map<string, FileView>();
  for (const [key, e] of Object.entries(course.sourceEvidence)) {
    try {
      const file = files.get(e.path) ?? (await readFileAt(dir, course.commit, e.path));
      files.set(e.path, file);
      verifyExcerpt(file, e);
    } catch (err) {
      if (!(err instanceof Problem)) throw err;
      throw new Problem(
        422,
        err.code,
        `${course.repositoryId}@${course.commit} · ${key} · ${e.path}：${err.message}`,
      );
    }
  }
  return transaction(db, () => {
    const key = [course.projectId, course.courseId, course.version] as const;
    const existing = db
      .prepare(
        "SELECT id,document FROM course_release WHERE project_id=? AND course_id=? AND version=?",
      )
      .get(...key);
    if (existing) {
      requireThat(
        isDeepStrictEqual(JSON.parse(String(existing.document)), course),
        409,
        "edition_conflict",
        "该版次已发布且内容不同，请使用新版本号。",
      );
      return Number(existing.id);
    }
    const latest = db
      .prepare("SELECT max(version) AS v FROM course_release WHERE project_id=? AND course_id=?")
      .get(course.projectId, course.courseId);
    requireThat(
      course.version === Number(latest?.v ?? 0) + 1,
      409,
      "version",
      "请从 1 开始，按已有版次递增发布。",
    );
    db.prepare("INSERT OR IGNORE INTO course VALUES (?,?)").run(course.projectId, course.courseId);
    const id = Number(
      db
        .prepare(
          "INSERT INTO course_release(project_id,course_id,version,repository_id,commit_sha,document) VALUES (?,?,?,?,?,?)",
        )
        .run(...key, course.repositoryId, course.commit, JSON.stringify(course)).lastInsertRowid,
    );
    for (const [key, e] of Object.entries(course.sourceEvidence))
      db.prepare("INSERT INTO source_evidence VALUES (?,?,?,?,?,?,?,?)").run(
        id,
        key,
        e.path,
        e.symbol,
        e.startLine,
        e.endLine,
        e.blobOid,
        e.excerptSha256,
      );
    course.lessons.forEach((lesson, i) => {
      db.prepare("INSERT INTO lesson VALUES (?,?,?,?)").run(id, lesson.id, i + 1, lesson.title);
      for (const ref of links.get(lesson.id)!)
        db.prepare("INSERT INTO lesson_evidence VALUES (?,?,?)").run(id, lesson.id, ref);
      for (const q of lesson.exercises)
        db.prepare("INSERT INTO exercise VALUES (?,?,?,?)").run(id, lesson.id, q.id, q.kind);
    });
    return id;
  });
}
export function evidenceFor(course: Course, id: string): Evidence {
  requireThat(
    Object.hasOwn(course.sourceEvidence, id),
    404,
    "evidence",
    "这条证据不属于当前版次。",
  );
  return course.sourceEvidence[id];
}
