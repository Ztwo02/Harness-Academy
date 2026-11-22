import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { catalog } from "../server/base.ts";
import { piCourse } from "../server/courses.ts";
import { launch } from "./fixture.ts";

test(
  "Pi baseline: replay identical citations from GitHub and/or an existing local repository",
  {
    skip: !process.env.ACADEMY_PI_DIRECTORY && process.env.ACADEMY_TEST_GITHUB !== "1",
    timeout: 320000,
  },
  async (t) => {
    const dir = mkdtempSync(path.join(tmpdir(), "academy-pi-"));
    const app = await launch(dir);
    t.after(async () => {
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    });
    const source = catalog[0],
      ids: number[] = [];
    for (const kind of ["github", "directory"] as const) {
      if (kind === "github" && process.env.ACADEMY_TEST_GITHUB !== "1") continue;
      if (kind === "directory" && !process.env.ACADEMY_PI_DIRECTORY) continue;
      const result = await app.importJob(
        source,
        kind,
        kind === "github" ? source.url : path.resolve(process.env.ACADEMY_PI_DIRECTORY!),
      );
      assert.equal(result.status, "done", result.message);
      ids.push(result.releaseId!);
      for (const [id, e] of Object.entries(piCourse.sourceEvidence)) {
        const page = await app.call("/releases/" + result.releaseId + "/evidence/" + id);
        assert.equal(page.status, 200, id);
        assert.equal(page.body.file.oid, e.blobOid);
      }
      const { body } = await app.call("/releases/" + result.releaseId + "/evidence/entry");
      assert.deepEqual(
        [body.evidence.startLine, body.evidence.endLine, body.evidence.blobOid],
        [32, 55, "193e3faf9607fee37207c1cd9ec337f1eab8cec5"],
      );
    }
    assert.equal(new Set(ids).size, 1);
  },
);
