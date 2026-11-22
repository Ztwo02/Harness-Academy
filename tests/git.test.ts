import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { checkPath, verifyExcerpt } from "../server/git.ts";
import type { Evidence, FileView } from "../shared/types";

test("relative Git paths are case-sensitive, allow spaces and Unicode, reject traversal and root files", () => {
  for (const name of ["src/函数 示例.ts", "README.md", "src/[glob].ts"]) checkPath(name);
  for (const name of ["", "../README", "src//x", "a/./x", "/tmp/file", "C:/f", "a\\\\b", "a\0b"])
    assert.throws(() => checkPath(name));
  checkPath("", true);
});
test("excerpt fingerprint preserves empty lines, exact ranges and trailing spaces", () => {
  const file: FileView = { path: "a", oid: "1".repeat(40), size: 8, content: "A\n\nB \n", lineCount: 3 };
  const evidence: Evidence = {
    path: "a",
    symbol: null,
    startLine: 1,
    endLine: 2,
    blobOid: file.oid,
    excerptSha256: createHash("sha256").update("A\n").digest("hex"),
  };
  verifyExcerpt(file, evidence);
  for (const change of [
    { endLine: 4 },
    { startLine: 0 },
    { endLine: 1 },
    { symbol: "absent" },
    { blobOid: "2".repeat(40) },
  ])
    assert.throws(() => verifyExcerpt(file, { ...evidence, ...change }));
});
