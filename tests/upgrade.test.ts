import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { launch, makeFixture } from "./fixture.ts";

test("offline bundled upgrade preserves old progress, notes, attempts and self-graded review across restart", async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "academy-upgrade-")),
    f = makeFixture(dir),
    data = path.join(dir, "data");
  const newer = structuredClone(f.course);
  newer.version = 2;
  newer.lessons[0].exercises.push({
    id: "self-trace",
    kind: "trace",
    prompt: "解释结果回填",
    rubric: ["写出回填位置"],
    explanation: newer.lessons[0].summary[0],
  });
  let app = await launch(data, [f.source], f.course);
  t.after(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const job = await app.importJob(f.source, "directory", f.repo),
    oldId = job.releaseId!;
  assert.equal(job.status, "done", job.message);
  const lesson = f.course.lessons[0].id;
  await app.call(`/releases/${oldId}/lessons/${lesson}/progress`, "PUT", { state: "completed" });
  await app.call("/entries", "POST", {
    releaseId: oldId,
    lessonId: lesson,
    kind: "note",
    body: "旧版仍可恢复",
  });
  await app.call("/attempts", "POST", {
    releaseId: oldId,
    lessonId: lesson,
    exerciseId: "event-bridge",
    answer: "push",
    requestId: randomUUID(),
  });
  await app.close();
  app = await launch(data, [f.source], [f.course, newer]);
  const updated = await app.call("/bundled-releases", "POST", {});
  assert.equal(updated.status, 200, JSON.stringify(updated.body));
  const rid = updated.body.releaseId;
  assert.equal((await app.call("/bundled-releases", "POST", {})).body.releaseId, rid);
  assert.equal((await app.call(`/releases/${oldId}/lessons/${lesson}`)).body.state, "completed");
  const old = (await app.call("/review?releaseId=" + oldId)).body;
  assert.equal(old.entries[0].body, "旧版仍可恢复");
  assert.equal(old.statistics.latestCorrect, 1);
  assert.equal((await app.call("/review?releaseId=" + rid)).body.statistics.completed, 0);
  const payload = {
    releaseId: rid,
    lessonId: lesson,
    exerciseId: "self-trace",
    answer: "回到上下文",
    requestId: randomUUID(),
  };
  assert.equal((await app.call("/attempts", "POST", payload)).status, 400);
  await app.call("/attempts", "POST", { ...payload, selfGrade: "incorrect" });
  await app.call("/attempts", "POST", {
    ...payload,
    requestId: randomUUID(),
    selfGrade: "correct",
  });
  let reviewed = (await app.call("/review?releaseId=" + rid)).body;
  assert.deepEqual(
    [reviewed.statistics.pending, reviewed.statistics.recovered, reviewed.statistics.attempts],
    [0, 1, 2],
  );
  assert.equal(
    reviewed.questions.find((q: { exerciseId: string }) => q.exerciseId === "self-trace").grading,
    "self",
  );
  await app.call("/attempts", "POST", {
    ...payload,
    requestId: randomUUID(),
    selfGrade: "incorrect",
  });
  await app.close();
  app = await launch(data, [f.source], [f.course, newer]);
  reviewed = (await app.call("/review?releaseId=" + rid)).body;
  assert.deepEqual(
    [
      reviewed.statistics.pending,
      reviewed.statistics.recovered,
      reviewed.statistics.latestCorrect,
      reviewed.statistics.attempts,
    ],
    [1, 0, 0, 3],
  );
});
