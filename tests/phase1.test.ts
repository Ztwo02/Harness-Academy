import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { catalog } from "../server/base.ts";
import { snapshotPath } from "../server/git.ts";
import { git, makeFixture, launch } from "./fixture.ts";

test("local learning journey, source integrity, edition isolation and offline restart", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "academy-e2e-"));
  const data = path.join(dir, "data"),
    f = makeFixture(dir),
    sources = [f.source, ...catalog.slice(1)];
  let app = await launch(data, sources, f.course);
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const initial = await app.call("/projects");
  assert.deepEqual(
    initial.body.map((x: { phase: number }) => x.phase),
    [1, 3, 4, 5],
  );
  assert.equal(initial.body[0].editions.length, 0);
  assert.equal((await app.call("/releases", "POST", f.course)).status, 422);
  // Uncommitted changes and the selected repository's config are not part of the snapshot.
  writeFileSync(path.join(f.repo, f.file), "work tree only");
  git(f.repo, "config", "core.attributesFile", path.join(dir, "irrelevant"));
  const first = await app.importJob(f.source, "directory", f.repo);
  assert.equal(first.status, "done", first.message);
  const rid = first.releaseId!,
    route = "/releases/" + rid,
    lesson = f.course.lessons[0].id;
  const original = snapshotPath(app.db, data, f.source.repositoryId, f.sha);
  assert.equal((await app.importJob(f.source, "directory", f.repo)).releaseId, rid);
  assert.equal(snapshotPath(app.db, data, f.source.repositoryId, f.sha), original);
  assert.equal((await app.importJob(f.source, "directory", f.repo, "0".repeat(40))).status, "failed");
  git(f.repo, "add", "--", f.file);
  git(f.repo, "commit", "-m", "moved upstream branch");
  renameSync(f.repo, f.repo + "-moved");
  const open = await app.call(route + "/evidence/entry");
  assert.equal(open.status, 200);
  assert.equal(open.body.file.lineCount, 3);
  assert.equal(open.body.file.content, "export function sample() {\n  return 1;\n}\n");
  assert.equal(open.body.file.oid, f.course.sourceEvidence.entry.blobOid);
  assert.ok((await app.call(route + "/tree")).body.entries.some((x: { name: string }) => x.name === f.file));
  for (const name of ["sample-link", "submodule"]) {
    assert.equal((await app.call(route + "/file?path=" + name)).status, 422);
    assert.equal((await app.call(route + "/tree?path=" + name)).status, 422);
  }
  const firstPage = (await app.call(route + "/tree?path=many")).body;
  const secondPage = (await app.call(route + "/tree?path=many&offset=" + firstPage.next)).body;
  assert.equal(firstPage.entries.length, 100);
  assert.equal(secondPage.entries.length, 3);
  assert.equal(secondPage.next, null);
  for (const [file, substring] of [
    ["binary.bin", "二进制"],
    ["large.txt", "1 MiB"],
  ]) {
    const result = await app.call(route + "/file?path=" + file);
    assert.equal(result.body.content, null);
    assert.ok(result.body.reason.includes(substring));
  }
  for (const p of ["../absent", "C:/file", "/outside", "x\\\\y"])
    assert.equal((await app.call(route + "/file?path=" + encodeURIComponent(p))).status, 400);
  assert.equal((await app.call(route + "/file?path=missing.ts")).status, 404);
  const reverse = await app.call(
    route + "/backlinks?" + new URLSearchParams({ path: f.file, start: "2", end: "2" }),
  );
  assert.ok(reverse.body.some((x: { lessonId: string }) => x.lessonId === lesson));
  const lp = route + "/lessons/" + lesson,
    qp = lp + "/progress";
  assert.equal((await app.call(lp)).body.chapter.exercises[0].correctOption, undefined);
  await app.call(qp, "PUT", { state: "reading", opening: true });
  await app.call(qp, "PUT", { state: "completed" });
  assert.equal((await app.call(qp, "PUT", { state: "reading", opening: true })).body.state, "completed");
  const entry = { releaseId: rid, lessonId: lesson, evidenceId: "entry" };
  assert.equal(
    (await app.call("/entries", "POST", { ...entry, kind: "note", body: "留住这段源码" })).status,
    201,
  );
  const question = await app.call("/entries", "POST", { ...entry, kind: "question", body: "何时结束？" });
  assert.equal((await app.call("/entries/" + question.body.id, "PATCH", { resolved: true })).status, 200);
  assert.equal(
    (await app.call("/entries", "POST", { ...entry, evidenceId: "missing", kind: "note", body: "x" })).status,
    422,
  );
  const answer = {
    releaseId: rid,
    lessonId: lesson,
    exerciseId: "event-bridge",
    answer: "append",
    requestId: randomUUID(),
  };
  assert.equal((await app.call("/attempts", "POST", answer)).body.result, "incorrect");
  assert.equal((await app.call("/attempts", "POST", answer)).status, 200);
  assert.equal((await app.call("/attempts", "POST", { ...answer, answer: "push" })).status, 409);
  const before = (await app.call("/review")).body;
  assert.equal(before.attempts.length, 1);
  assert.equal(before.attempts[0].latest, true);
  assert.equal(
    (await app.call("/attempts", "POST", { ...answer, answer: "push", requestId: randomUUID() })).body.result,
    "correct",
  );

  for (const [key, mutate] of Object.entries({
    range: (c: typeof f.course) => {
      c.sourceEvidence.entry.endLine = 99;
    },
    digest: (c: typeof f.course) => {
      c.sourceEvidence.entry.excerptSha256 = "a".repeat(64);
    },
    blob: (c: typeof f.course) => {
      c.sourceEvidence.entry.blobOid = "a".repeat(40);
    },
    project: (c: typeof f.course) => {
      c.projectId = "codex";
    },
    ref: (c: typeof f.course) => {
      c.lessons[0].summary[0].sourceRefs = ["unknown"];
    },
    missing: (c: typeof f.course) => {
      c.lessons[0].execution = [];
    },
    path: (c: typeof f.course) => {
      c.sourceEvidence.entry.path = "absent.ts";
    },
    cycle: (c: typeof f.course) => {
      c.lessons[0].prerequisiteLessons = [lesson];
    },
  })) {
    const changed = structuredClone(f.course);
    changed.version = 2;
    mutate(changed);
    assert.equal((await app.call("/releases", "POST", changed)).status, 422, key);
  }
  assert.equal((await app.call("/releases", "POST", { ...f.course, title: "changed" })).status, 409);
  const v2 = { ...f.course, version: 2 };
  const concurrent = await Promise.all([
    app.call("/releases", "POST", v2),
    app.call("/releases", "POST", v2),
  ]);
  assert.equal(concurrent[0].body.releaseId, concurrent[1].body.releaseId);
  assert.equal(
    (await app.call("/releases/" + concurrent[0].body.releaseId + "/lessons/" + lesson)).body.state,
    "unstarted",
  );

  await app.close();
  // Start the production entry point in a fresh process without the original checkout.
  const child = spawn(process.execPath, ["server/main.ts"], {
    env: { ...process.env, HARNESS_PORT: "0", HARNESS_DATA_DIR: data },
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true,
  });
  try {
    const [chunk] = await once(child.stdout, "data", { signal: AbortSignal.timeout(15000) });
    const base = String(chunk).match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    assert.ok(base, "production server printed its loopback address");
    assert.equal((await (await fetch(base + "/api" + lp)).json()).state, "completed");
    assert.equal(
      (await (await fetch(base + "/api" + route + "/evidence/entry")).json()).file.oid,
      open.body.file.oid,
    );
    assert.equal((await (await fetch(base + "/api/review")).json()).attempts.length, 2);
  } finally {
    const exit = once(child, "exit");
    child.kill();
    await exit;
  }
  app = await launch(data, sources, f.course);
  assert.equal(
    (await app.call(route + "/evidence/entry")).body.file.oid,
    f.course.sourceEvidence.entry.blobOid,
  );
  const saved = (await app.call("/review?releaseId=" + rid)).body;
  assert.deepEqual(
    saved.attempts.map((a: { result: string; latest: boolean }) => [a.result, a.latest]),
    [
      ["correct", true],
      ["incorrect", false],
    ],
  );
  assert.ok(
    saved.entries.some(
      (e: { body: string; resolved: number }) => e.body === "何时结束？" && e.resolved === 1,
    ),
  );
  assert.ok(saved.entries.some((e: { body: string }) => e.body === "留住这段源码"));
  assert.equal((await app.call(lp)).body.state, "completed");

  renameSync(original, original + "-damaged");
  assert.equal((await app.call(route + "/evidence/entry")).status, 422);
  const repaired = await app.importJob(f.source, "directory", f.repo + "-moved", f.sha);
  assert.equal(repaired.releaseId, rid, repaired.message);
  assert.equal((await app.call(route + "/evidence/entry")).status, 200);
  assert.equal((await app.call("/review")).body.attempts.length, 2);
  assert.deepEqual(app.db.prepare("PRAGMA foreign_key_check").all(), []);
});
test("local API trust boundary and invalid public import source", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "academy-boundary-"));
  const app = await launch(dir);
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const origin = new URL(app.base).origin;
  assert.equal(
    (await fetch(app.base + "/projects", { headers: { Origin: "https://example.invalid" } })).status,
    403,
  );
  assert.equal(
    (
      await fetch(app.base + "/entries", {
        method: "POST",
        headers: { Origin: origin, "Content-Type": "application/json" },
        body: "{}",
      })
    ).status,
    403,
  );
  const duplicate = await fetch(app.base + "/releases", {
    method: "POST",
    headers: { "X-Academy-Token": app.token, "Content-Type": "application/json" },
    body: '{"a":1,"a":2}',
  });
  assert.equal(duplicate.status, 400);
  for (const value of [
    "file:///tmp/demo",
    "https://example.invalid/pi.git",
    "https://user@github.com/agentic-labs/pi-mono",
  ]) {
    const job = await app.importJob(catalog[0], "github", value);
    assert.equal(job.status, "failed");
    assert.match(job.message, /地址/);
  }
});
