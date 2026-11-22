import { readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { CatalogSource } from "../shared/types.ts";
import { visit } from "jsonc-parser";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const catalog: CatalogSource[] = JSON.parse(
  readFileSync(path.join(root, "config/repositories.json"), "utf8"),
).repositories;

export class Problem extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
    this.code = code;
  }
}
export function requireThat(
  condition: unknown,
  status: number,
  code: string,
  message: string,
): asserts condition {
  if (!condition) throw new Problem(status, code, message);
}
export function parseJson(raw: string): unknown {
  const keys: Set<string>[] = [];
  let depth = 0;
  const enter = () => requireThat(++depth <= 64, 400, "depth", "JSON 嵌套过深，请检查课程格式。");
  visit(
    raw,
    {
      onObjectBegin() {
        enter();
        keys.push(new Set());
      },
      onObjectEnd() {
        depth--;
        keys.pop();
      },
      onArrayBegin: enter,
      onArrayEnd() {
        depth--;
      },
      onObjectProperty(key) {
        const seen = keys.at(-1)!;
        requireThat(!seen.has(key), 400, "duplicate_key", `JSON 字段重复：${key}`);
        seen.add(key);
      },
      onError() {
        throw new Problem(400, "json", "JSON 格式错误，请检查输入。");
      },
    },
    { disallowComments: true, allowTrailingComma: false },
  );
  return JSON.parse(raw);
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function openStore(dir: string) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const filename = path.join(dir, "academy.sqlite");
  const db = new DatabaseSync(filename);
  try {
    db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000");
    const version = Number(db.prepare("PRAGMA user_version").get()!.user_version);
    requireThat(
      version <= 2,
      409,
      "newer_database",
      "数据目录来自较新版本，请升级 Harness Academy 或选择新的数据目录。",
    );
    if (version === 0) db.exec(readFileSync(path.join(root, "docs/schema/academy.sql"), "utf8"));
    if (version < 2) {
      const backup = path.join(dir, "pre-v2-" + Date.now() + ".sqlite");
      if (version === 1 && !existsSync(backup)) db.prepare("VACUUM INTO ?").run(backup);
      transaction(db, () =>
        db.exec(`
        CREATE TABLE revision_store (
          repository_id TEXT NOT NULL, commit_sha TEXT NOT NULL, generation TEXT NOT NULL UNIQUE,
          PRIMARY KEY (repository_id, commit_sha),
          FOREIGN KEY (repository_id, commit_sha) REFERENCES revision(repository_id, commit_sha)
        ) STRICT;
        PRAGMA user_version=2;
      `),
      );
    }
    db.exec("PRAGMA journal_mode=WAL");
    transaction(db, () => {
      for (const src of catalog) {
        db.prepare("INSERT OR IGNORE INTO project VALUES (?,?,?)").run(src.projectId, src.name, src.phase);
        db.prepare("INSERT OR IGNORE INTO repository VALUES (?,?,'public-repo',?)").run(
          src.repositoryId,
          src.projectId,
          src.url,
        );
      }
    });
    return db;
  } catch (err) {
    db.close();
    throw err;
  }
}
