import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { catalog } from "../server/base.ts";
import { codexCourse } from "../server/courses.ts";
import { launch } from "./fixture.ts";

test(
  "Codex baseline: replay all lessons and citations from independent fixed Git sources",
  {
    skip: !process.env.ACADEMY_CODEX_DIRECTORY && process.env.ACADEMY_TEST_CODEX_GITHUB !== "1",
    timeout: 600000,
  },
  async (t) => {
    const data = mkdtempSync(path.join(tmpdir(), "academy-codex-")),
      app = await launch(data);
    t.after(async () => {
      await app.close();
      rmSync(data, { recursive: true, force: true });
    });
    const source = catalog[1],
      ids: number[] = [];
    for (const kind of ["github", "directory"] as const) {
      if (kind === "github" && process.env.ACADEMY_TEST_CODEX_GITHUB !== "1") continue;
      if (kind === "directory" && !process.env.ACADEMY_CODEX_DIRECTORY) continue;
      const job = await app.importJob(
        source,
        kind,
        kind === "github" ? source.url : path.resolve(process.env.ACADEMY_CODEX_DIRECTORY!),
      );
      assert.equal(job.status, "done", job.message);
      const rid = job.releaseId!;
      ids.push(rid);
      for (const [key, e] of Object.entries(codexCourse.sourceEvidence)) {
        const result = await app.call(`/releases/${rid}/evidence/${key}`);
        assert.equal(result.status, 200, key + JSON.stringify(result.body));
        assert.equal(result.body.file.oid, e.blobOid);
        assert.equal(result.body.evidence.startLine, e.startLine);
      }
      for (const lesson of codexCourse.lessons) {
        const page = await app.call(`/releases/${rid}/lessons/${lesson.id}`);
        assert.equal(page.body.projectId, "codex");
        assert.equal(page.body.commit, source.baselineCommit);
        const tutor = await app.call(`/releases/${rid}/tutor?lesson=${lesson.id}`);
        assert.equal(tutor.status, 200, JSON.stringify(tutor.body));
        assert.equal(tutor.body.cards[0].title, lesson.title);
        const q = lesson.exercises.find((q) => q.kind === "single-choice")!;
        if (q.kind === "single-choice")
          assert.equal(
            (
              await app.call("/attempts", "POST", {
                releaseId: rid,
                lessonId: lesson.id,
                exerciseId: q.id,
                answer: q.correctOption,
                requestId: randomUUID(),
              })
            ).body.result,
            "correct",
          );
      }
      const found = await app.call(
        `/releases/${rid}/symbols?symbol=run_turn&kind=definition&scope=codex-rs/core/src`,
      );
      assert.equal(found.status, 200, JSON.stringify(found.body));
      assert.ok(
        found.body.candidates.some(
          (c: { path: string; line: number }) =>
            c.path === "codex-rs/core/src/session/turn.rs" && c.line === 227,
        ),
      );
      const full = await app.call(`/releases/${rid}/symbols?symbol=run_turn`);
      assert.equal(full.status, 422);
      assert.equal(full.body.code, "index_budget");
      assert.equal(
        (await app.call("/projects")).body.find((p: { projectId: string }) => p.projectId === "pi")
          .editions.length,
        0,
      );
    }
    assert.equal(new Set(ids).size, 1);
  },
);
