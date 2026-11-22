import express, { type ErrorRequestHandler } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { catalog, openStore, parseJson, Problem, requireThat, root } from "./base.ts";
import { importRevision, oidPattern, readFileAt, snapshotPath, treePage, verifyExcerpt } from "./git.ts";
import { evidenceFor, getLesson, getRelease, piCourse, publish } from "./courses.ts";
import { chapterPage, projects, recordAnswer, review } from "./study.ts";
import type { CatalogSource, Course, ImportJob } from "../shared/types.ts";

const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const positive = z.number().int().positive().safe();
const content = z.string().trim().min(1).max(16000);
const importInput = z
  .object({
    repositoryId: id,
    kind: z.enum(["github", "directory"]),
    locator: z.string().trim().min(1).max(4096),
    commit: z.string().regex(oidPattern),
  })
  .strict();
const entryInput = z
  .object({
    releaseId: positive,
    lessonId: id,
    evidenceId: id.nullable().optional(),
    kind: z.enum(["note", "question"]),
    body: content,
  })
  .strict();
const answerInput = z
  .object({
    releaseId: positive,
    lessonId: id,
    exerciseId: id,
    answer: content,
    requestId: z.uuid(),
    selfGrade: z.enum(["correct", "incorrect"]).optional(),
  })
  .strict();

function integer(value: unknown, min = 1) {
  requireThat(
    typeof value === "string" &&
      /^\d+$/.test(value) &&
      Number.isSafeInteger(Number(value)) &&
      Number(value) >= min,
    400,
    "number",
    "请输入有效的编号或行号。",
  );
  return Number(value);
}
function stringParam(value: unknown) {
  requireThat(typeof value === "string" && value.length <= 4096, 400, "parameter", "路径或查询参数无效。");
  return value;
}

export function createAcademy(
  dataDir: string,
  sources: CatalogSource[] = catalog,
  bundled: Course = piCourse,
) {
  const db = openStore(dataDir),
    app = express(),
    token = randomBytes(32).toString("hex");
  const jobs = new Map<string, ImportJob>();
  const api = express.Router();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const host = req.headers.host;
    const allowed = ["localhost", "127.0.0.1"].map(
      (name) => name + (req.socket.localPort === 80 ? "" : ":" + req.socket.localPort),
    );
    requireThat(host && allowed.includes(host.toLowerCase()), 403, "host", "请使用启动时输出的本机地址。");
    requireThat(
      !req.headers.origin || req.headers.origin === "http://" + host,
      403,
      "origin",
      "仅接受本机同源请求。",
    );
    requireThat(
      req.headers["sec-fetch-site"] !== "cross-site" ||
        (req.method === "GET" && !req.path.startsWith("/api")),
      403,
      "origin",
      "拒绝跨站数据请求。",
    );
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    });
    next();
  });
  app.use("/api", api);
  api.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(req.method)) {
      requireThat(req.get("X-Academy-Token") === token, 403, "session", "本地会话已更新，请刷新页面重试。");
      requireThat(req.is("application/json"), 415, "content_type", "请提交 application/json。");
    }
    next();
  });
  api.use(express.text({ type: "application/json", limit: "2mb" }));
  api.use((req, _res, next) => {
    if (!["GET", "HEAD"].includes(req.method)) req.body = parseJson(req.body ?? "");
    next();
  });
  api.get("/session", (_req, res) => res.json({ token }));
  api.get("/projects", (_req, res) => res.json(projects(db, sources)));
  api.post("/imports", (req, res) => {
    const body = importInput.parse(req.body);
    const source = sources.find((x) => x.repositoryId === body.repositoryId);
    requireThat(source, 404, "source", "请先选择登记的仓库。");
    requireThat(
      ![...jobs.values()].some((x) => x.status === "working"),
      409,
      "busy",
      "正在导入一个仓库，请等待当前任务完成。",
    );
    if (jobs.size >= 32) jobs.delete(jobs.keys().next().value!);
    const job: ImportJob = { id: randomUUID(), status: "working", message: "正在获取并核对 Git 对象…" };
    jobs.set(job.id, job);
    void (async () => {
      try {
        await importRevision(db, dataDir, source, body.kind, body.locator, body.commit);
        if (body.repositoryId === bundled.repositoryId && body.commit === bundled.commit) {
          job.message = "已固定源码，正在验证课程证据…";
          job.releaseId = await publish(db, dataDir, bundled);
        }
        job.status = "done";
        job.message = job.releaseId
          ? "源码与课程证据已核验，可以开始学习。"
          : "已固定源码；此提交暂未发布课程。";
      } catch (e) {
        job.status = "failed";
        job.message =
          e instanceof Problem ? e.message : "导入失败，请检查 Git、磁盘空间和数据目录权限后重试。";
      }
    })();
    res.status(202).json(job);
  });
  api.get("/imports/:id", (req, res) => {
    const job = jobs.get(req.params.id);
    requireThat(job, 404, "job", "任务已结束或服务已重启，请刷新仓库列表。");
    res.json(job);
  });
  api.post("/releases", async (req, res) => res.json({ releaseId: await publish(db, dataDir, req.body) }));
  api.get("/releases/:rid/lessons/:lesson", (req, res) =>
    res.json(chapterPage(db, integer(req.params.rid), req.params.lesson)),
  );
  api.put("/releases/:rid/lessons/:lesson/progress", (req, res) => {
    const rid = integer(req.params.rid),
      lesson = req.params.lesson;
    const { state, opening } = z
      .object({ state: z.enum(["reading", "completed", "unstarted"]), opening: z.literal(true).optional() })
      .strict()
      .parse(req.body);
    getLesson(getRelease(db, rid), lesson);
    requireThat(!opening || state === "reading", 400, "progress", "自动打开章节只可标记为学习中。");
    db.prepare(
      `INSERT INTO lesson_progress(release_id,lesson_id,state) VALUES (?,?,?)
      ON CONFLICT(release_id,lesson_id) DO UPDATE SET state=excluded.state,updated_at=CURRENT_TIMESTAMP
      WHERE ?=0 OR lesson_progress.state='unstarted'`,
    ).run(rid, lesson, state, opening ? 1 : 0);
    res.json(
      db.prepare("SELECT state FROM lesson_progress WHERE release_id=? AND lesson_id=?").get(rid, lesson),
    );
  });
  api.get("/releases/:rid/tree", async (req, res) => {
    const c = getRelease(db, integer(req.params.rid));
    res.json(
      await treePage(
        snapshotPath(db, dataDir, c.repositoryId, c.commit),
        c.commit,
        stringParam(req.query.path ?? ""),
        integer(req.query.offset ?? "0", 0),
      ),
    );
  });
  api.get("/releases/:rid/file", async (req, res) => {
    const c = getRelease(db, integer(req.params.rid));
    res.json(
      await readFileAt(
        snapshotPath(db, dataDir, c.repositoryId, c.commit),
        c.commit,
        stringParam(req.query.path),
      ),
    );
  });
  api.get("/releases/:rid/evidence/:eid", async (req, res) => {
    const c = getRelease(db, integer(req.params.rid)),
      e = evidenceFor(c, req.params.eid);
    const file = await readFileAt(snapshotPath(db, dataDir, c.repositoryId, c.commit), c.commit, e.path);
    verifyExcerpt(file, e);
    res.json({ evidence: e, file });
  });
  api.get("/releases/:rid/backlinks", (req, res) => {
    const rid = integer(req.params.rid);
    getRelease(db, rid);
    const start = integer(req.query.start),
      end = integer(req.query.end);
    requireThat(start <= end, 400, "range", "结束行应大于或等于起始行。");
    res.json(
      db
        .prepare(
          `SELECT l.id lessonId,l.title,e.id evidenceId,e.start_line startLine,e.end_line endLine
      FROM source_evidence e JOIN lesson_evidence le ON le.release_id=e.release_id AND le.evidence_id=e.id
      JOIN lesson l ON l.release_id=e.release_id AND l.id=le.lesson_id
      WHERE e.release_id=? AND e.path=? AND e.start_line<=? AND e.end_line>=? ORDER BY l.ordinal,e.start_line`,
        )
        .all(rid, stringParam(req.query.path), end, start),
    );
  });
  api.post("/entries", (req, res) => {
    const b = entryInput.parse(req.body);
    getLesson(getRelease(db, b.releaseId), b.lessonId);
    if (b.evidenceId)
      requireThat(
        db
          .prepare("SELECT 1 FROM lesson_evidence WHERE release_id=? AND lesson_id=? AND evidence_id=?")
          .get(b.releaseId, b.lessonId, b.evidenceId),
        422,
        "citation",
        "选择本章引用的证据。",
      );
    const row = db
      .prepare("INSERT INTO learning_entry(release_id,lesson_id,evidence_id,kind,body) VALUES (?,?,?,?,?)")
      .run(b.releaseId, b.lessonId, b.evidenceId ?? null, b.kind, b.body);
    res.status(201).json({ id: Number(row.lastInsertRowid) });
  });
  api.patch("/entries/:id", (req, res) => {
    const eid = integer(req.params.id);
    const b = z
      .object({ body: content.optional(), resolved: z.boolean().optional() })
      .strict()
      .parse(req.body);
    requireThat(Object.keys(b).length, 400, "empty", "请指定要更新的内容。");
    const entry = db.prepare("SELECT kind FROM learning_entry WHERE id=?").get(eid);
    requireThat(entry, 404, "entry", "记录不存在。");
    requireThat(
      b.resolved === undefined || entry.kind === "question",
      400,
      "question",
      "只可标记疑问的解决状态。",
    );
    db.prepare(
      "UPDATE learning_entry SET body=coalesce(?,body),resolved=coalesce(?,resolved),updated_at=CURRENT_TIMESTAMP WHERE id=?",
    ).run(b.body ?? null, b.resolved === undefined ? null : Number(b.resolved), eid);
    res.json({ id: eid });
  });
  api.post("/attempts", (req, res) => res.json(recordAnswer(db, answerInput.parse(req.body))));
  api.get("/review", (req, res) =>
    res.json(
      review(
        db,
        req.query.releaseId === undefined ? undefined : integer(req.query.releaseId),
        req.query.projectId === undefined ? undefined : stringParam(req.query.projectId),
      ),
    ),
  );
  api.use((_req, _res) => {
    throw new Problem(404, "route", "未找到本地接口。");
  });
  const dist = path.join(root, "dist");
  app.use(express.static(dist, { index: false, redirect: false, dotfiles: "deny" }));
  app.get(/.*/, (req, res) => {
    requireThat(
      !path.extname(req.path) && existsSync(path.join(dist, "index.html")),
      404,
      "frontend",
      "页面不可用，请先运行 npm run build。",
    );
    res.set("Cache-Control", "no-cache").sendFile(path.join(dist, "index.html"));
  });
  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof Problem) {
      res.status(err.status).json({ code: err.code, message: err.message });
      return;
    }
    if (err instanceof z.ZodError) {
      res
        .status(400)
        .json({
          code: "input",
          message: "请检查输入：" + err.issues.map((x) => x.path.join(".")).join("、"),
        });
      return;
    }
    if (err.type === "entity.too.large") {
      res.status(413).json({ code: "size", message: "请求超过 2 MiB 上限。" });
      return;
    }
    res.status(500).json({ code: "internal", message: "本地服务未能完成操作，请检查数据目录并重试。" });
  };
  app.use(errors);
  return { app, db };
}
