import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { catalog } from "../server/base.ts";
import { claudeCourse, claudeSdkCourse } from "../server/courses.ts";
import { launch } from "./fixture.ts";

test("Claude public and official SDK fixed sources replay all evidence, tutors and exercises independently", {
  skip: !process.env.ACADEMY_CLAUDE_DIRECTORY && !process.env.ACADEMY_CLAUDE_SDK_DIRECTORY && process.env.ACADEMY_TEST_CLAUDE_GITHUB !== "1",
  timeout: 600000,
}, async t => {
  const dir = mkdtempSync(path.join(tmpdir(), "academy-claude-")), app = await launch(dir);
  t.after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  for (const [source, course, directory] of [
    [catalog[3], claudeCourse, process.env.ACADEMY_CLAUDE_DIRECTORY],
    [catalog[4], claudeSdkCourse, process.env.ACADEMY_CLAUDE_SDK_DIRECTORY],
  ] as const) {
    const ids: number[] = [];
    for (const kind of ["github", "directory"] as const) {
      if (kind === "github" && process.env.ACADEMY_TEST_CLAUDE_GITHUB !== "1") continue;
      if (kind === "directory" && !directory) continue;
      const job = await app.importJob(source, kind, kind === "github" ? source.url : path.resolve(directory!));
      assert.equal(job.status, "done", job.message);
      const rid = job.releaseId!; ids.push(rid);
      for (const [key, e] of Object.entries(course.sourceEvidence)) {
        const response = await app.call(`/releases/${rid}/evidence/${key}`);
        assert.equal(response.status, 200, JSON.stringify(response.body));
        assert.equal(response.body.file.oid, e.blobOid);
        const excerpt = response.body.file.content.split("\n").slice(e.startLine - 1, e.endLine).join("\n");
        assert.equal(createHash("sha256").update(excerpt).digest("hex"), e.excerptSha256, key);
      }
      for (const l of course.lessons) {
        const page = await app.call(`/releases/${rid}/lessons/${l.id}`);
        assert.equal(page.body.sourceKind, course.sourceKind);
        assert.equal(page.body.repositoryId, source.repositoryId);
        assert.ok(page.body.unverifiedQuestions.length);
        const tutor = await app.call(`/releases/${rid}/tutor?lesson=${l.id}`);
        assert.equal(tutor.status, 200, JSON.stringify(tutor.body));
        assert.equal(tutor.body.sourceKind, course.sourceKind);
        const q = l.exercises.find(q => q.kind === "single-choice")!;
        if (q.kind === "single-choice") assert.equal((await app.call("/attempts", "POST", {
          releaseId: rid, lessonId: l.id, exerciseId: q.id, answer: q.correctOption, requestId: randomUUID(),
        })).body.result, "correct");
      }
      const sdk = course.sourceKind === "sdk-repo";
      const found = await app.call(`/releases/${rid}/symbols?` + new URLSearchParams({
        symbol: sdk ? "query" : "_validate_command", kind: "definition",
        scope: sdk ? "src/claude_agent_sdk/query.py" : "examples/hooks/bash_command_validator_example.py",
      }));
      assert.equal(found.status, 200, JSON.stringify(found.body));
      assert.equal(found.body.candidates.length, 1);
      assert.equal(found.body.candidates[0].line, sdk ? 11 : 48);
    }
    if (ids.length) assert.equal(new Set(ids).size, 1);
  }
});
