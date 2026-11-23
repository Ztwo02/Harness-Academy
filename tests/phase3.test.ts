import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { catalog } from "../server/base.ts";
import { snapshotPath } from "../server/git.ts";
import { git, launch, makeFixture } from "./fixture.ts";

test("Codex and Pi keep same lesson, evidence, path and exercise identifiers isolated across restart and repair", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "academy-p3-"));
  mkdirSync(path.join(dir, "pi"));
  mkdirSync(path.join(dir, "codex"));
  const pi = makeFixture(path.join(dir, "pi")),
    codex = makeFixture(path.join(dir, "codex"));
  const content = "export function sample() {\n  return 2;\n}\n";
  writeFileSync(path.join(codex.repo, codex.file), content);
  writeFileSync(
    path.join(codex.repo, "core.rs"),
    "pub(crate) async fn run_turn<T>() {}\nfn run_turn_extra() {}\n",
  );
  mkdirSync(path.join(codex.repo, "[module]"));
  writeFileSync(
    path.join(codex.repo, "[module]", "core.rs"),
    "pub struct Session {}\npub trait Handler {}\npub fn run_turn() {}\n",
  );
  git(codex.repo, "add", "--", ".");
  git(codex.repo, "commit", "-m", "independent Codex fixture");
  codex.sha = git(codex.repo, "rev-parse", "HEAD");
  Object.assign(codex.course, {
    projectId: "codex",
    repositoryId: "codex-cli",
    commit: codex.sha,
    title: "Codex synthetic course",
  });
  for (const e of Object.values(codex.course.sourceEvidence))
    Object.assign(e, {
      blobOid: git(codex.repo, "rev-parse", codex.sha + ":" + codex.file),
      excerptSha256: createHash("sha256").update(content.trimEnd()).digest("hex"),
    });
  const exercise = codex.course.lessons[0].exercises[0];
  assert.equal(exercise.kind, "single-choice");
  if (exercise.kind === "single-choice") exercise.correctOption = "append";
  codex.course.lessons[0].scenario = "Codex synthetic scenario";
  const codexSource = { ...catalog[1], baselineCommit: codex.sha };
  const sources = [pi.source, codexSource, ...catalog.slice(2)],
    bundles = [pi.course, codex.course];
  const data = path.join(dir, "data");
  let app = await launch(data, sources, bundles);
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  assert.deepEqual(
    (await app.call("/projects")).body.map((p: { available: boolean }) => p.available),
    [true, true, false, false],
  );
  // Import Codex first: absence of Pi objects must not block an independent course.
  const cjob = await app.importJob(codexSource, "directory", codex.repo);
  assert.equal(cjob.status, "done", cjob.message);
  const crid = cjob.releaseId!;
  assert.equal(
    (await app.call("/bundled-releases", "POST", { projectId: "codex" })).body.releaseId,
    crid,
  );
  assert.equal(
    (await app.call("/bundled-releases", "POST", { projectId: "deepseek" })).status,
    404,
  );
  assert.equal((await app.call("/bundled-releases", "POST", {})).status, 422);
  assert.equal(
    (await app.call(`/releases/${crid}/tutor?q=sample`)).body.cards[0].scenario,
    "Codex synthetic scenario",
  );
  const pjob = await app.importJob(pi.source, "directory", pi.repo);
  assert.equal(pjob.status, "done", pjob.message);
  const prid = pjob.releaseId!;
  assert.notEqual(prid, crid);
  for (const [rid, value] of [
    [prid, "return 1"],
    [crid, "return 2"],
  ] as const) {
    const file = (await app.call(`/releases/${rid}/evidence/entry`)).body.file;
    assert.ok(file.content.includes(value));
    const backlinks = await app.call(
      `/releases/${rid}/backlinks?` +
        new URLSearchParams({ path: codex.file, start: "1", end: "3" }),
    );
    assert.equal(backlinks.body.length, 6);
  }
  const scoped = (
    await app.call(`/releases/${crid}/symbols?symbol=run_turn&kind=definition&scope=core.rs`)
  ).body;
  assert.deepEqual(
    scoped.candidates.map((c: { path: string; line: number }) => [c.path, c.line]),
    [["core.rs", 1]],
  );
  const literal = await app.call(
    `/releases/${crid}/symbols?` + new URLSearchParams({ symbol: "run_turn", scope: "[module]" }),
  );
  assert.equal(literal.body.candidates.length, 1);
  assert.equal(literal.body.candidates[0].path, "[module]/core.rs");
  assert.equal(
    (await app.call(`/releases/${prid}/symbols?symbol=run_turn`)).body.candidates.length,
    0,
  );
  for (const symbol of ["Session", "Handler"])
    assert.equal(
      (await app.call(`/releases/${crid}/symbols?symbol=${symbol}&scope=%5Bmodule%5D`)).body
        .candidates.length,
      1,
    );
  for (const scope of ["../codex", "C:/secret", "x\\y"])
    assert.equal(
      (
        await app.call(
          `/releases/${crid}/symbols?symbol=run_turn&scope=` + encodeURIComponent(scope),
        )
      ).status,
      400,
    );
  assert.equal(
    (await app.call(`/releases/${crid}/symbols?symbol=run_turn&scope=absent`)).body.candidates
      .length,
    0,
  );
  // Valid identifiers with the wrong project, revision or blob still fail evidence publication.
  for (const change of [
    { projectId: "pi" },
    { commit: pi.sha },
    { sourceEvidence: { ...codex.course.sourceEvidence, entry: pi.course.sourceEvidence.entry } },
  ])
    assert.equal(
      (await app.call("/releases", "POST", { ...codex.course, version: 2, ...change })).status,
      422,
    );
  assert.equal((await app.call("/releases?projectId=pi", "POST", codex.course)).status, 422);
  assert.equal(
    (await app.call("/releases?projectId=codex", "POST", codex.course)).body.projectId,
    "codex",
  );
  const lesson = pi.course.lessons[0].id,
    requestId = randomUUID();
  const answer = {
    releaseId: prid,
    lessonId: lesson,
    exerciseId: "event-bridge",
    answer: "push",
    requestId,
  };
  assert.equal((await app.call("/attempts", "POST", answer)).body.result, "correct");
  assert.equal((await app.call("/attempts", "POST", { ...answer, releaseId: crid })).status, 409);
  assert.equal(
    (await app.call("/attempts", "POST", { ...answer, releaseId: crid, requestId: randomUUID() }))
      .body.result,
    "incorrect",
  );
  for (const [rid, body] of [
    [prid, "Pi note"],
    [crid, "Codex note"],
  ] as const) {
    await app.call("/entries", "POST", {
      releaseId: rid,
      lessonId: lesson,
      kind: "note",
      body,
      evidenceId: "entry",
    });
  }
  await app.call(`/releases/${prid}/lessons/${lesson}/progress`, "PUT", { state: "completed" });
  assert.equal((await app.call(`/releases/${crid}/lessons/${lesson}`)).body.state, "unstarted");
  assert.equal((await app.call("/review?projectId=pi")).body.statistics.latestCorrect, 1);
  assert.equal((await app.call("/review?projectId=codex")).body.statistics.pending, 1);
  assert.equal(
    (await app.call(`/review?releaseId=${prid}&projectId=codex`)).body.entries.length,
    0,
  );
  const oldReview = (await app.call("/review?projectId=pi")).body;
  const damaged = snapshotPath(app.db, data, "codex-cli", codex.sha);
  renameSync(damaged, damaged + "-missing");
  assert.equal((await app.call(`/releases/${crid}/evidence/entry`)).status, 422);
  assert.equal((await app.call(`/releases/${prid}/evidence/entry`)).status, 200);
  assert.deepEqual((await app.call("/review?projectId=pi")).body, oldReview);
  assert.equal((await app.importJob(codexSource, "directory", codex.repo)).releaseId, crid);
  await app.close();
  app = await launch(data, sources, bundles);
  assert.deepEqual((await app.call("/review?projectId=pi")).body, oldReview);
  assert.equal((await app.call(`/releases/${crid}/evidence/entry`)).status, 200);
  assert.equal((await app.call("/review?projectId=codex")).body.entries[0].body, "Codex note");
});
