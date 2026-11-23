import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { catalog } from "../server/base.ts";
import { snapshotPath } from "../server/git.ts";
import { git, launch, makeFixture } from "./fixture.ts";

test("Bundled catalog preserves four project entries when Claude gains an independent SDK source", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "academy-p4-catalog-")), app = await launch(dir);
  t.after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  const projects = (await app.call("/projects")).body;
  assert.deepEqual(projects.map((p: { available: boolean }) => p.available), [true, true, true, true]);
  assert.ok(projects.every((p: { editions: unknown[] }) => p.editions.length === 0));
  assert.equal((await app.call("/bundled-releases", "POST", { projectId: "claude" })).status, 422);
});

test("DeepSeek same-path symbols, citations and study records stay isolated from Pi/Codex across repair, update and restart", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "academy-p4-"));
  const fixtures = ["pi", "codex", "deepseek"].map((id, i) => {
    const location = path.join(dir, id);
    mkdirSync(location);
    const f = makeFixture(location);
    const content = `export function sample() {\n  return ${i + 1};\n}\n`;
    writeFileSync(path.join(f.repo, f.file), content);
    writeFileSync(path.join(f.repo, "agent.ts"), `export class ReactLoopAgent {\n  step() { return ${i + 1}; }\n  stepExtra() {}\n}\n`);
    git(f.repo, "add", "--", ".");
    git(f.repo, "commit", "-m", id + " independent fixture");
    f.sha = git(f.repo, "rev-parse", "HEAD");
    f.source = { ...catalog[i], baselineCommit: f.sha };
    Object.assign(f.course, { projectId: id, repositoryId: f.source.repositoryId,
      commit: f.sha, title: id + " synthetic course" });
    for (const e of Object.values(f.course.sourceEvidence)) Object.assign(e, {
      blobOid: git(f.repo, "rev-parse", f.sha + ":" + f.file),
      excerptSha256: createHash("sha256").update(content.trimEnd()).digest("hex"),
    });
    f.course.lessons[0].scenario = id + " scenario";
    const q = f.course.lessons[0].exercises[0];
    if (q.kind === "single-choice" && id === "deepseek") q.correctOption = "append";
    return f;
  });
  const sources = [...fixtures.map(f => f.source), catalog[3]], bundles = fixtures.map(f => f.course);
  const data = path.join(dir, "data");
  let app = await launch(data, sources, bundles);
  t.after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  const releases = new Map<string, number>();
  // DeepSeek imports first and never requires the other repositories' objects.
  for (const f of [fixtures[2], fixtures[0], fixtures[1]]) {
    const job = await app.importJob(f.source, "directory", f.repo);
    assert.equal(job.status, "done", job.message);
    releases.set(f.source.projectId, job.releaseId!);
  }
  assert.equal(new Set(releases.values()).size, 3);
  const lesson = fixtures[0].course.lessons[0].id, requestId = randomUUID();
  for (const [i, f] of fixtures.entries()) {
    const projectId = f.source.projectId, rid = releases.get(projectId)!;
    const file = (await app.call(`/releases/${rid}/evidence/entry`)).body.file;
    assert.ok(file.content.includes(`return ${i + 1}`));
    const tutor = await app.call(`/releases/${rid}/tutor?q=sample`);
    assert.equal(tutor.body.cards[0].scenario, projectId + " scenario");
    const search = await app.call(`/releases/${rid}/symbols?symbol=step&kind=definition&scope=agent.ts`);
    assert.deepEqual(search.body.candidates.map((c: { text: string; line: number }) => [c.line, c.text]),
      [[2, `step() { return ${i + 1}; }`]]);
    assert.ok(search.body.scope.startsWith(`${f.source.repositoryId}@${f.sha}`));
    const backlinks = await app.call(`/releases/${rid}/backlinks?` + new URLSearchParams({
      path: f.file, start: "1", end: "3",
    }));
    assert.ok(backlinks.body.every((b: { lessonId: string }) => b.lessonId === lesson));
    await app.call("/entries", "POST", { releaseId: rid, lessonId: lesson, kind: "note", body: projectId + " note" });
    const answer = { releaseId: rid, lessonId: lesson, exerciseId: "event-bridge", answer: "push", requestId };
    if (i === 0) assert.equal((await app.call("/attempts", "POST", answer)).body.result, "correct");
    else assert.equal((await app.call("/attempts", "POST", answer)).status, 409);
    if (i === 2) assert.equal((await app.call("/attempts", "POST", { ...answer, requestId: randomUUID() })).body.result, "incorrect");
  }
  const deep = fixtures[2], drid = releases.get("deepseek")!;
  assert.equal((await app.call("/bundled-releases", "POST", { projectId: "deepseek" })).body.releaseId, drid);
  for (const f of fixtures.slice(0, 2)) {
    for (const change of [
      { projectId: f.source.projectId }, { commit: f.sha },
      { sourceEvidence: { ...deep.course.sourceEvidence, entry: f.course.sourceEvidence.entry } },
    ]) assert.equal((await app.call("/releases", "POST", { ...deep.course, version: 2, ...change })).status, 422);
    assert.equal((await app.call(`/releases?projectId=${f.source.projectId}`, "POST", deep.course)).status, 422);
  }
  const planned = { ...deep.course, projectId: "claude", repositoryId: "claude-code" };
  assert.equal((await app.call("/releases", "POST", planned)).body.code, "source_category");
  await app.call(`/releases/${drid}/lessons/${lesson}/progress`, "PUT", { state: "completed" });
  const oldReviews = await Promise.all(["pi", "codex", "deepseek"].map(async p => (await app.call(`/review?projectId=${p}`)).body));
  assert.equal(oldReviews[2].statistics.pending, 1);
  assert.equal(oldReviews[0].statistics.latestCorrect, 1);
  assert.equal(oldReviews[1].statistics.attempted, 0);
  const damaged = snapshotPath(app.db, data, deep.source.repositoryId, deep.sha);
  renameSync(damaged, damaged + "-missing");
  assert.equal((await app.call(`/releases/${drid}/tutor?lesson=${lesson}`)).status, 422);
  assert.equal((await app.call(`/releases/${drid}/evidence/entry`)).status, 422);
  for (const projectId of ["pi", "codex"])
    assert.equal((await app.call(`/releases/${releases.get(projectId)}/evidence/entry`)).status, 200);
  assert.equal((await app.importJob(deep.source, "directory", deep.repo)).releaseId, drid);
  const v2 = await app.call("/releases?projectId=deepseek", "POST", { ...deep.course, version: 2 });
  assert.equal(v2.status, 200, JSON.stringify(v2.body));
  assert.equal((await app.call(`/releases/${v2.body.releaseId}/lessons/${lesson}`)).body.state, "unstarted");
  assert.equal((await app.call(`/releases/${drid}/lessons/${lesson}`)).body.state, "completed");
  await app.close();
  app = await launch(data, sources, bundles);
  for (const [i, projectId] of ["pi", "codex"].entries())
    assert.deepEqual((await app.call(`/review?projectId=${projectId}`)).body, oldReviews[i]);
  assert.equal((await app.call(`/review?releaseId=${drid}`)).body.entries[0].body, "deepseek note");
  assert.equal((await app.call(`/releases/${drid}/evidence/entry`)).status, 200);
});
