import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { makeFixture, launch, git } from "./fixture.ts";

test("fixed-version candidate navigation, reviewed tutor, wrong-answer retries and statistics", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "academy-p2-")),
    f = makeFixture(dir);
  writeFileSync(
    path.join(f.repo, "other.ts"),
    "// sample is only a text reference here\nexport function sampleElsewhere() {}\nexport const sample = 2;\n",
  );
  git(f.repo, "add", "--", "other.ts");
  git(f.repo, "commit", "-m", "symbol candidates");
  f.sha = git(f.repo, "rev-parse", "HEAD");
  f.source.baselineCommit = f.sha;
  f.course.commit = f.sha;
  const data = path.join(dir, "data"),
    app = await launch(data, [f.source], f.course);
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const imported = await app.importJob(f.source, "directory", f.repo);
  assert.equal(imported.status, "done", imported.message);
  const rid = imported.releaseId!,
    base = `/releases/${rid}`;
  const definitions = await app.call(base + "/symbols?symbol=sample&kind=definition");
  assert.equal(definitions.status, 200, JSON.stringify(definitions.body));
  assert.deepEqual(
    definitions.body.candidates.map((c: { path: string; line: number }) => [c.path, c.line]).sort(),
    [
      ["other.ts", 3],
      [f.file, 1],
    ].sort(),
  );
  const references = await app.call(base + "/symbols?symbol=sample&kind=reference");
  assert.equal(references.body.candidates.length, 3);
  assert.match(references.body.scope, /不提供语言级/);
  writeFileSync(path.join(f.repo, "other.ts"), "function changed() {}\n");
  assert.deepEqual(
    (await app.call(base + "/symbols?symbol=sample&kind=reference")).body,
    references.body,
  );
  assert.equal((await app.call(base + "/symbols?symbol=absent")).body.candidates.length, 0);
  for (const symbol of ["../x", "-e", "a.b", "a|b", "x".repeat(81)])
    assert.equal(
      (await app.call(base + "/symbols?symbol=" + encodeURIComponent(symbol))).status,
      400,
    );
  assert.equal((await app.call(base + "/symbols?symbol=sample&kind=execute")).status, 400);
  const lesson = f.course.lessons[0].id;
  assert.equal(
    (await app.call(base + "/tutor?lesson=" + lesson + "&q=sample")).body.cards.length,
    1,
  );
  const unknown = await app.call(base + "/tutor?q=nonexistent-question");
  assert.equal(unknown.body.cards.length, 0);
  assert.match(unknown.body.notice, /待验证/);
  assert.equal((await app.call(base + "/tutor?lesson=absent")).status, 404);
  let stats = (await app.call("/review?releaseId=" + rid)).body.statistics;
  assert.deepEqual([stats.chapters, stats.exercises, stats.attempted, stats.pending], [1, 1, 0, 0]);
  const answer = {
    releaseId: rid,
    lessonId: lesson,
    exerciseId: "event-bridge",
    answer: "append",
    requestId: randomUUID(),
  };
  await app.call("/attempts", "POST", answer);
  await app.call("/attempts", "POST", answer);
  stats = (await app.call("/review")).body.statistics;
  assert.deepEqual([stats.attempts, stats.pending, stats.firstCorrect], [1, 1, 0]);
  await app.call("/attempts", "POST", { ...answer, answer: "push", requestId: randomUUID() });
  const after = (await app.call("/review?releaseId=" + rid)).body;
  assert.deepEqual(
    [
      after.statistics.attempts,
      after.statistics.latestCorrect,
      after.statistics.recovered,
      after.statistics.pending,
    ],
    [2, 1, 1, 0],
  );
  assert.deepEqual([after.questions[0].first, after.questions[0].latest], ["incorrect", "correct"]);
  const newer = structuredClone(f.course);
  newer.version = 2;
  const rid2 = (await app.call("/releases", "POST", newer)).body.releaseId;
  assert.equal((await app.call("/review?releaseId=" + rid2)).body.statistics.attempted, 0);
  assert.equal((await app.call("/review?projectId=codex")).body.statistics.exercises, 0);
  assert.equal((await app.call("/review")).body.statistics.exercises, 2);
  assert.equal(
    (await app.call("/review?releaseId=" + rid + "&projectId=codex")).body.statistics.exercises,
    0,
  );
});
