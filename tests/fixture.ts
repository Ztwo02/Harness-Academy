import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { catalog } from "../server/base.ts";
import { createAcademy } from "../server/app.ts";
import { piCourse } from "../server/courses.ts";
import type { CatalogSource, Course, ImportJob } from "../shared/types";

export function git(dir: string, ...args: string[]) {
  return execFileSync(
    "git",
    ["-C", dir, "-c", "core.hooksPath=/dev/null", "-c", "commit.gpgSign=false", ...args],
    { encoding: "utf8", windowsHide: true },
  ).trim();
}
export function makeFixture(dir: string) {
  const repo = path.join(dir, "repo");
  mkdirSync(repo);
  git(repo, "init", "--template=", "-b", "main");
  git(repo, "config", "core.autocrlf", "false");
  git(repo, "config", "user.name", "Fixture");
  git(repo, "config", "user.email", "fixture@example.invalid");
  const file = "示例 code.ts",
    bytes = Buffer.from("\uFEFFexport function sample() {\r\n  return 1;\r\n}\r\n");
  writeFileSync(path.join(repo, file), bytes);
  writeFileSync(path.join(repo, "binary.bin"), Buffer.from([0, 1, 2]));
  writeFileSync(path.join(repo, "large.txt"), Buffer.alloc(1024 ** 2 + 1, 65));
  git(repo, "add", "--", ".");
  git(repo, "commit", "-m", "fixture");
  const first = git(repo, "rev-parse", "HEAD");
  const link = execFileSync("git", ["-C", repo, "hash-object", "-w", "--stdin"], {
    input: file,
    encoding: "utf8",
  }).trim();
  git(repo, "update-index", "--add", "--cacheinfo", "120000," + link + ",sample-link");
  git(repo, "update-index", "--add", "--cacheinfo", "160000," + first + ",submodule");
  mkdirSync(path.join(repo, "many"));
  for (let i = 0; i < 103; i++) writeFileSync(path.join(repo, "many", String(i).padStart(3, "0")), "file");
  git(repo, "add", "--", "many");
  git(repo, "commit", "-m", "tree fixture");
  const sha = git(repo, "rev-parse", "HEAD");
  const course = structuredClone(piCourse);
  course.commit = sha;
  // Synthetic evidence throughout this fixture. The real course has a separate opt-in replay.
  for (const [key, e] of Object.entries(course.sourceEvidence)) {
    Object.assign(e, {
      path: file,
      symbol: key === "entry" ? "sample" : null,
      startLine: 1,
      endLine: 3,
      blobOid: git(repo, "rev-parse", "HEAD:" + file),
      excerptSha256: createHash("sha256").update("export function sample() {\n  return 1;\n}").digest("hex"),
    });
  }
  course.lessons[0].keySymbols = [{ name: "sample", sourceRef: "entry" }];
  return { repo, sha, course, file, source: { ...catalog[0], baselineCommit: sha } };
}
export async function launch(dir: string, sources: CatalogSource[] = catalog, course: Course = piCourse) {
  const { app, db } = createAcademy(dir, sources, course),
    server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + (server.address() as AddressInfo).port + "/api";
  const { token } = await (await fetch(base + "/session")).json();
  async function call(route: string, method = "GET", body?: unknown) {
    const response = await fetch(base + route, {
      method,
      headers: { "Content-Type": "application/json", "X-Academy-Token": token },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  async function importJob(
    source: CatalogSource,
    kind: "directory" | "github",
    locator: string,
    commit = source.baselineCommit,
  ) {
    const start = await call("/imports", "POST", {
      repositoryId: source.repositoryId,
      kind,
      locator,
      commit,
    });
    if (start.status !== 202) throw new Error(JSON.stringify(start));
    let job: ImportJob = start.body;
    const until = Date.now() + 150000;
    while (job.status === "working" && Date.now() < until) {
      await new Promise((r) => setTimeout(r, 100));
      job = (await call("/imports/" + job.id)).body;
    }
    return job;
  }
  async function close() {
    await new Promise<void>((resolve, reject) => {
      server.close((e) => (e ? reject(e) : resolve()));
      server.closeIdleConnections();
    });
    db.close();
  }
  return { db, base, token, call, importJob, close };
}
