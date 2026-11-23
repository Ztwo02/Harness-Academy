import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { catalog, root } from "../server/base.ts";
import { readingCards, verifyReading } from "../server/readings.ts";
import { git, launch, makeFixture } from "./fixture.ts";
import type { Claim } from "../shared/types.ts";

test("Claude public repository and SDK retain independent provenance, evidence and histories", async t => {
  const dir = mkdtempSync(path.join(tmpdir(), "academy-phase5-"));
  const fixtures = [catalog[3], catalog[4]].map((source, i) => {
    const loc = path.join(dir, String(i)); mkdirSync(loc);
    const f = makeFixture(loc), content = `export function sample() {\n  return ${i + 1};\n}\n`;
    writeFileSync(path.join(f.repo, f.file), content);
    writeFileSync(path.join(f.repo, "client.py"), `async def query():\n    return ${i + 1}\ndef query_extra():\n    pass\n`);
    git(f.repo, "add", "--", "."); git(f.repo, "commit", "-m", "independent source " + i);
    f.sha = git(f.repo, "rev-parse", "HEAD"); f.source = { ...source, baselineCommit: f.sha };
    const category = source.sourceKind ?? "public-repo";
    Object.assign(f.course, { schemaVersion: 2, projectId: "claude", repositoryId: source.repositoryId,
      commit: f.sha, sourceKind: category, unverifiedQuestions: [{ id: "internal", question: "内部如何调度？", reason: "没有内部源码", verificationNeeded: "独立公开来源" }] });
    for (const e of Object.values(f.course.sourceEvidence)) Object.assign(e, {
      blobOid: git(f.repo, "rev-parse", f.sha + ":" + f.file), excerptSha256: createHash("sha256").update(content.trimEnd()).digest("hex"),
    });
    f.course.courseId = i ? "sdk-fixture" : "public-fixture";
    const l = f.course.lessons[0];
    const all: Claim[] = [...l.concepts, ...l.execution, ...l.calls, ...l.designRationale, ...l.summary, ...l.faq.map(x => x.answer), ...l.exercises.map(x => x.explanation)];
    all.forEach(c => c.sourceCategory = category);
    return f;
  });
  const sources = [...catalog.slice(0, 3), ...fixtures.map(f => f.source)], bundles = fixtures.map(f => f.course);
  const data = path.join(dir, "data"); let app = await launch(data, sources, bundles);
  t.after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  const sdkJob = await app.importJob(fixtures[1].source, "directory", fixtures[1].repo);
  assert.equal(sdkJob.status, "done", sdkJob.message);
  const sdkId = sdkJob.releaseId!;
  assert.equal((await app.call("/bundled-releases", "POST", { projectId: "claude" })).body.releaseId, sdkId);
  const publicJob = await app.importJob(fixtures[0].source, "directory", fixtures[0].repo);
  assert.equal(publicJob.status, "done", publicJob.message);
  const publicId = publicJob.releaseId!; assert.notEqual(publicId, sdkId);
  assert.equal((await app.call("/releases?projectId=claude&repositoryId=claude-code", "POST", fixtures[1].course)).status, 422);
  const projects = (await app.call("/projects")).body;
  assert.equal(projects.length, 4);
  const claude = projects.find((p: { projectId: string }) => p.projectId === "claude");
  assert.equal(claude.repositories.length, 2); assert.equal(claude.editions.length, 2);
  const lesson = fixtures[0].course.lessons[0].id;
  for (const [i, rid] of [publicId, sdkId].entries()) {
    assert.ok((await app.call(`/releases/${rid}/evidence/entry`)).body.file.content.includes(`return ${i + 1}`));
    assert.equal((await app.call(`/releases/${rid}/lessons/${lesson}`)).body.sourceKind, i ? "sdk-repo" : "public-repo");
    const tutor = await app.call(`/releases/${rid}/tutor?lesson=${lesson}`);
    assert.equal(tutor.body.sourceKind, i ? "sdk-repo" : "public-repo");
    assert.equal(tutor.body.unverifiedQuestions.length, 1);
    const nav = await app.call(`/releases/${rid}/symbols?symbol=query&kind=definition&scope=client.py`);
    assert.equal(nav.body.candidates.length, 1); assert.ok(nav.body.candidates[0].text.endsWith("query():"));
    await app.call("/entries", "POST", { releaseId: rid, lessonId: lesson, kind: "note", body: i ? "SDK note" : "public note" });
    await app.call("/attempts", "POST", { releaseId: rid, lessonId: lesson, exerciseId: "event-bridge", answer: "push", requestId: randomUUID() });
  }
  for (const change of [
    { sourceKind: "public-repo" }, { repositoryId: "claude-code" }, { commit: fixtures[0].sha },
    { sourceEvidence: { ...fixtures[1].course.sourceEvidence, entry: fixtures[0].course.sourceEvidence.entry } },
  ]) assert.equal((await app.call("/releases", "POST", { ...fixtures[1].course, version: 2, ...change })).status, 422);
  for (const category of ["public-repo", "internal"]) {
    const c = structuredClone(fixtures[1].course); c.version = 2;
    c.lessons[0].concepts[0].sourceCategory = category as Claim["sourceCategory"];
    c.lessons[0].concepts[0].kind = "fact";
    assert.equal((await app.call("/releases", "POST", c)).status, 422);
  }
  const internalFact = structuredClone(fixtures[1].course);
  Object.assign(internalFact.unverifiedQuestions![0], { kind: "fact", text: "未经验证的内部实现" });
  assert.equal((await app.call("/releases", "POST", internalFact)).status, 422);
  const reviews = (await app.call("/review?projectId=claude")).body;
  assert.equal(reviews.entries.length, 2);
  assert.equal((await app.call(`/review?releaseId=${sdkId}`)).body.entries[0].body, "SDK note");
  await app.close(); app = await launch(data, sources, bundles);
  assert.deepEqual((await app.call("/review?projectId=claude")).body, reviews);
  assert.equal((await app.call(`/releases/${sdkId}/evidence/entry`)).status, 200);
});

test("Official reading snapshots validate response, heading, excerpt, immutable identity and repair offline", async t => {
  const data = mkdtempSync(path.join(tmpdir(), "academy-readings-")); let app = await launch(data);
  t.after(async () => { await app.close(); rmSync(data, { recursive: true, force: true }); });
  assert.ok((await app.call("/reading-cards")).body.every((c: { state: string }) => c.state === "unimported"));
  for (const card of readingCards) {
    const bytes = readFileSync(path.join(root, "materials/claude", card.sha256 + ".txt"));
    assert.ok(verifyReading(card, bytes).includes(card.excerpt));
    assert.throws(() => verifyReading({ ...card, sha256: "0".repeat(64) }, bytes));
    assert.throws(() => verifyReading({ ...card, locator: "# nonexistent" }, bytes));
    if (card.id === "sdk-overview")
      assert.throws(() => verifyReading({ ...card, locator: "# Agent SDK overview" }, bytes));
    assert.throws(() => verifyReading({ ...card, excerpt: "unverified paragraph" }, bytes));
    assert.throws(() => verifyReading({ ...card, url: "https://attacker.invalid/" as typeof card.url }, bytes));
    assert.equal((await app.call(`/reading-cards/${card.id}/1`)).status, 404);
    assert.equal((await app.call("/reading-cards/import", "POST", { id: card.id, version: 1 })).status, 200);
    assert.equal((await app.call(`/reading-cards/${card.id}/1`)).body.sha256, card.sha256);
    const response = await fetch(app.base + `/reading-cards/${card.id}/1/snapshot`);
    assert.match(response.headers.get("content-type")!, /^text\/plain/);
    assert.equal(createHash("sha256").update(await response.text()).digest("hex"), card.sha256);
    writeFileSync(path.join(data, "materials", card.sha256), "tampered");
    assert.equal((await app.call(`/reading-cards/${card.id}/1`)).status, 422);
    assert.equal((await app.call("/reading-cards")).body.find((c: { id: string }) => c.id === card.id).state, "damaged");
    assert.equal((await app.call("/reading-cards/import", "POST", { id: card.id, version: 1 })).status, 200);
  }
  assert.equal((await app.call("/reading-cards/import", "POST", { id: "../escape", version: 1 })).status, 400);
  const card = readingCards[0], filename = path.join(data, "readings", card.id + ".v1.json");
  writeFileSync(filename, JSON.stringify({ ...card, title: "changed" }));
  assert.equal((await app.call("/reading-cards/import", "POST", { id: card.id, version: 1 })).status, 409);
  writeFileSync(filename, JSON.stringify(card));
  await app.close(); app = await launch(data);
  assert.equal((await app.call(`/reading-cards/${card.id}/1`)).body.excerpt, card.excerpt);
});
