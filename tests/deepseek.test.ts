import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { catalog } from "../server/base.ts";
import { deepseekCourse } from "../server/courses.ts";
import { launch } from "./fixture.ts";

test("DeepSeek baseline: replay every citation, lesson, exercise and scoped navigation from fixed Git sources", {
  skip: !process.env.ACADEMY_DEEPSEEK_DIRECTORY && process.env.ACADEMY_TEST_DEEPSEEK_GITHUB !== "1",
  timeout: 600000,
}, async (t) => {
  const data = mkdtempSync(path.join(tmpdir(), "academy-deepseek-"));
  let app = await launch(data);
  t.after(async () => {
    await app.close();
    rmSync(data, { recursive: true, force: true });
  });
  const source = catalog[2], ids: number[] = [];
  for (const kind of ["github", "directory"] as const) {
    if (kind === "github" && process.env.ACADEMY_TEST_DEEPSEEK_GITHUB !== "1") continue;
    if (kind === "directory" && !process.env.ACADEMY_DEEPSEEK_DIRECTORY) continue;
    const job = await app.importJob(source, kind,
      kind === "github" ? source.url : path.resolve(process.env.ACADEMY_DEEPSEEK_DIRECTORY!));
    assert.equal(job.status, "done", job.message);
    const rid = job.releaseId!;
    ids.push(rid);
    for (const [key, e] of Object.entries(deepseekCourse.sourceEvidence)) {
      const result = await app.call(`/releases/${rid}/evidence/${key}`);
      assert.equal(result.status, 200, key + JSON.stringify(result.body));
      assert.deepEqual(result.body.evidence, e);
      assert.equal(result.body.file.oid, e.blobOid);
      const excerpt = result.body.file.content.split("\n").slice(e.startLine - 1, e.endLine).join("\n");
      assert.equal(createHash("sha256").update(excerpt).digest("hex"), e.excerptSha256, key);
      const backlinks = await app.call(`/releases/${rid}/backlinks?` + new URLSearchParams({
        path: e.path, start: String(e.startLine), end: String(e.endLine),
      }));
      assert.ok(backlinks.body.length > 0, key);
    }
    for (const lesson of deepseekCourse.lessons) {
      const page = await app.call(`/releases/${rid}/lessons/${lesson.id}`);
      assert.equal(page.body.projectId, "deepseek");
      assert.equal(page.body.commit, source.baselineCommit);
      assert.ok(page.body.chapter.exercises.every((q: object) => !("correctOption" in q) && !("explanation" in q)));
      const tutor = await app.call(`/releases/${rid}/tutor?lesson=${lesson.id}`);
      assert.equal(tutor.status, 200, JSON.stringify(tutor.body));
      assert.equal(tutor.body.cards[0].title, lesson.title);
      const q = lesson.exercises.find(q => q.kind === "single-choice")!;
      if (q.kind === "single-choice") {
        const answer = { releaseId: rid, lessonId: lesson.id, exerciseId: q.id,
          answer: q.options.find(o => o.id !== q.correctOption)!.id, requestId: randomUUID() };
        assert.equal((await app.call("/attempts", "POST", answer)).body.result, "incorrect");
        assert.equal((await app.call("/attempts", "POST", { ...answer, answer: q.correctOption,
          requestId: randomUUID() })).body.result, "correct");
      }
    }
    const found = await app.call(`/releases/${rid}/symbols?` + new URLSearchParams({
      symbol: "followup", kind: "definition", scope: "packages/core/agent-loop/src/agent.ts",
    }));
    assert.equal(found.status, 200, JSON.stringify(found.body));
    assert.deepEqual(found.body.candidates.map((c: { path: string; line: number }) => [c.path, c.line]),
      [["packages/core/agent-loop/src/agent.ts", 180]]);
    assert.equal((await app.call(`/releases/${rid}/tutor?q=run_turn`)).body.cards.length, 0);
    // This repository exceeds the existing full-corpus budget; narrowing the scope is required.
    const full = await app.call(`/releases/${rid}/symbols?symbol=followup`);
    assert.equal(full.status, 422);
    assert.equal(full.body.code, "index_budget");
    assert.equal((await app.call("/bundled-releases", "POST", { projectId: "deepseek" })).body.releaseId, rid);
  }
  assert.equal(new Set(ids).size, 1);
  const rid = ids[0], lesson = deepseekCourse.lessons[0].id;
  await app.call("/entries", "POST", { releaseId: rid, lessonId: lesson, kind: "question",
    body: "默认原生路径以外的执行器仍需独立取证", evidenceId: "base-executor" });
  await app.call(`/releases/${rid}/lessons/${lesson}/progress`, "PUT", { state: "completed" });
  const review = (await app.call("/review?projectId=deepseek")).body;
  assert.equal(review.statistics.exercises, 4);
  assert.equal(review.statistics.recovered, 3);
  assert.equal(review.statistics.pending, 0);
  for (const projectId of ["pi", "codex"])
    assert.equal((await app.call(`/review?projectId=${projectId}`)).body.statistics.exercises, 0);
  await app.close();
  app = await launch(data);
  assert.deepEqual((await app.call("/review?projectId=deepseek")).body, review);
  assert.equal((await app.call(`/releases/${rid}/evidence/input`)).status, 200);
  assert.equal((await app.call(`/releases/${rid}/lessons/${lesson}`)).body.state, "completed");
});
