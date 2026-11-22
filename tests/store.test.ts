import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { openStore, parseJson, root } from "../server/base.ts";

test("empty database, v1 upgrade and refusal to downgrade a newer database", (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), "academy-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const filename = path.join(dir, "academy.sqlite");
  let db = new DatabaseSync(filename);
  db.exec(readFileSync(path.join(root, "docs/schema/academy.sql"), "utf8"));
  db.prepare("INSERT INTO project VALUES ('custom','本地',1)").run();
  db.close();
  db = openStore(dir);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM project").get()!.n, 5);
  assert.equal(db.prepare("PRAGMA foreign_keys").get()!.foreign_keys, 1);
  assert.equal(db.prepare("PRAGMA user_version").get()!.user_version, 2);
  assert.ok(readdirSync(dir).some((p) => p.startsWith("pre-v2-")));
  db.close();
  db = openStore(dir);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM project").get()!.n, 5);
  db.exec("PRAGMA user_version=99");
  db.close();
  assert.throws(() => openStore(dir), /较新版本/);
  db = new DatabaseSync(filename, { readOnly: true });
  assert.equal(db.prepare("PRAGMA user_version").get()!.user_version, 99);
  db.close();
});
test("course JSON rejects duplicate keys before a parser can discard them", () => {
  assert.throws(() => parseJson('{"a":{"b":1,"b":2}}'), /重复/);
  assert.throws(() => parseJson('{"a":1,}'));
  assert.deepEqual(parseJson('[{"a":1},{"a":2}]'), [{ a: 1 }, { a: 2 }]);
});
