import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { Problem, requireThat, transaction } from "./base.ts";
import type { CatalogSource, Evidence, FileView, TreePage } from "../shared/types.ts";

const run = promisify(execFile);
export const oidPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const MAX_FILE = 1024 * 1024;
const MAX_OBJECT_BYTES = 2 * 1024 ** 3;
const objectMessage = "无法读取固定提交的 Git 对象，请从仓库管理重新导入同一 SHA。";

// Git only operates inside directories created by this service, including the local transport source.
async function git(
  dir: string,
  args: string[],
  options: { protocol?: "file" | "https"; timeout?: number } = {},
) {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    TMP: process.env.TMP,
    TEMP: process.env.TEMP,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_ALLOW_PROTOCOL: options.protocol ?? "none",
    GIT_LFS_SKIP_SMUDGE: "1",
    LC_ALL: "C",
  };
  try {
    const { stdout } = await run(
      "git",
      [
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "credential.helper=",
        "-c",
        "http.followRedirects=false",
        "-c",
        "fetch.recurseSubmodules=false",
        "-c",
        "gc.auto=0",
        "-c",
        "maintenance.auto=false",
        "--git-dir=" + dir,
        ...args,
      ],
      {
        cwd: path.dirname(dir),
        env,
        windowsHide: true,
        timeout: options.timeout ?? 15_000,
        maxBuffer: 16 * 1024 ** 2,
        encoding: "buffer",
      },
    );
    return stdout;
  } catch (cause) {
    throw new Problem(422, "git_object", objectMessage, { cause });
  }
}
async function initBare(dir: string, sha: string) {
  await git(dir, [
    "init",
    "--bare",
    "--template=",
    "--object-format=" + (sha.length === 40 ? "sha1" : "sha256"),
    dir,
  ]);
}

async function localObjects(locator: string, target: string, sha: string) {
  requireThat(
    path.isAbsolute(locator) && !/^(?:\\\\|\/\/)/.test(locator),
    400,
    "directory",
    "请输入本机 Git 仓库的绝对目录。",
  );
  const parent = await realpath(locator);
  const dotGit = path.join(parent, ".git");
  const dot = await lstat(dotGit).catch(() => null);
  requireThat(
    !dot || dot.isDirectory(),
    422,
    "git_directory",
    "请选择普通 Git 工作树或裸仓库；关联工作树可选择主仓库目录。",
  );
  const source = path.join(dot ? dotGit : parent, "objects");
  requireThat((await lstat(source)).isDirectory(), 422, "objects", "该目录不含普通 Git 对象库。");
  // Copy only loose objects and standard packs. Never read config, hooks, alternates or filters.
  const started = Date.now();
  let bytes = 0,
    files = 0;
  for (const group of await readdir(source, { withFileTypes: true })) {
    if (!(group.name === "pack" || /^[0-9a-f]{2}$/.test(group.name)) || !group.isDirectory()) continue;
    const from = path.join(source, group.name);
    const to = path.join(target, "objects", group.name);
    await mkdir(to, { recursive: true });
    const valid =
      group.name === "pack"
        ? /^pack-(?:[0-9a-f]{40}|[0-9a-f]{64})\.(?:idx|pack)$/
        : new RegExp("^[0-9a-f]{" + (sha.length - 2) + "}$");
    for (const file of await readdir(from, { withFileTypes: true })) {
      if (!valid.test(file.name) || !file.isFile()) continue;
      const name = path.join(from, file.name);
      bytes += (await stat(name)).size;
      requireThat(
        ++files <= 100000 && bytes <= MAX_OBJECT_BYTES && Date.now() - started < 120000,
        422,
        "budget",
        "对象库超过导入预算，请使用只含目标提交的浅仓库。",
      );
      await copyFile(name, path.join(to, file.name));
    }
  }
  requireThat(
    (await git(target, ["cat-file", "-t", sha])).toString().trim() === "commit",
    422,
    "commit",
    "所选目录中找不到指定 commit。",
  );
  return parent;
}

async function verifyLocalIdentity(db: DatabaseSync, source: CatalogSource, dir: string, sha: string) {
  if (
    sha === source.baselineCommit ||
    db.prepare("SELECT 1 FROM revision WHERE repository_id=? AND commit_sha=?").get(source.repositoryId, sha)
  )
    return;
  // Tie a different local revision to the registered project by Git ancestry, never by folder name.
  for (const [ancestor, descendant] of [
    [source.baselineCommit, sha],
    [sha, source.baselineCommit],
  ]) {
    try {
      await git(dir, ["merge-base", "--is-ancestor", ancestor, descendant]);
      return;
    } catch {
      /* A shallow copy may lack one side of this ancestry proof. */
    }
  }
  throw new Problem(
    422,
    "source_identity",
    "无法确认本地提交属于所选项目。请使用课程基线，或先通过登记的 GitHub 地址固定此提交。",
  );
}

export async function importRevision(
  db: DatabaseSync,
  dir: string,
  src: CatalogSource,
  kind: "github" | "directory",
  locator: string,
  sha: string,
) {
  requireThat(oidPattern.test(sha), 400, "sha", "请提供完整的小写 Git Commit SHA。");
  if (kind === "github") {
    requireThat(
      locator
        .replace(/\.git\/?$/, "")
        .replace(/\/$/, "")
        .toLowerCase() === src.url.toLowerCase(),
      400,
      "source_url",
      "地址须与所选项目登记的 HTTPS GitHub 仓库一致。",
    );
    locator = src.url;
  }
  const objects = path.join(dir, "repositories");
  await mkdir(objects, { recursive: true });
  const staging = await mkdtemp(path.join(objects, "stage-"));
  const snapshot = path.join(staging, "snapshot.git");
  const marker = randomUUID() + ".git";
  let kept = false;
  try {
    await initBare(snapshot, sha);
    let remote = locator;
    if (kind === "directory") {
      const sanitized = path.join(staging, "input.git");
      await initBare(sanitized, sha);
      locator = await localObjects(locator, sanitized, sha);
      await verifyLocalIdentity(db, src, sanitized, sha);
      await writeFile(path.join(sanitized, "shallow"), sha + "\n");
      await git(sanitized, ["update-ref", "refs/heads/pin", sha]);
      remote = pathToFileURL(sanitized).href;
    }
    await git(
      snapshot,
      [
        "-c",
        "fetch.fsckObjects=true",
        "-c",
        "fetch.unpackLimit=1",
        "fetch",
        "--depth=1",
        "--no-tags",
        "--no-write-fetch-head",
        remote,
        sha + ":refs/heads/pin",
      ],
      { protocol: kind === "github" ? "https" : "file", timeout: 120000 },
    );
    await git(snapshot, ["symbolic-ref", "HEAD", "refs/heads/pin"]);
    requireThat(
      (await git(snapshot, ["cat-file", "-t", sha])).toString().trim() === "commit",
      422,
      "commit",
      "目标对象不是 Git 提交。",
    );
    await git(snapshot, ["fsck", "--full", "--no-reflogs"], { timeout: 120000 });
    const previous = db
      .prepare("SELECT generation FROM revision_store WHERE repository_id=? AND commit_sha=?")
      .get(src.repositoryId, sha);
    let generation = previous && String(previous.generation);
    if (generation) {
      try {
        const current = path.join(objects, generation);
        const pin = (await git(current, ["rev-parse", "--verify", "refs/heads/pin"])).toString().trim();
        requireThat(pin === sha, 422, "damaged_pin", objectMessage);
        await git(current, ["fsck", "--full", "--no-reflogs", sha], {
          timeout: 120000,
        });
      } catch {
        generation = undefined;
      }
    }
    if (!generation) {
      await rename(snapshot, path.join(objects, marker));
      generation = marker;
    }
    transaction(db, () => {
      db.prepare("INSERT OR IGNORE INTO revision(repository_id,commit_sha) VALUES (?,?)").run(
        src.repositoryId,
        sha,
      );
      db.prepare("INSERT OR REPLACE INTO revision_store VALUES (?,?,?)").run(
        src.repositoryId,
        sha,
        generation!,
      );
      db.prepare(
        "INSERT OR IGNORE INTO repository_import(repository_id,origin_kind,origin_locator) VALUES (?,?,?)",
      ).run(src.repositoryId, kind, locator);
    });
    kept = true;
  } catch (err) {
    if (err instanceof Problem && err.code !== "git_object") throw err;
    throw new Problem(
      422,
      "import_failed",
      `无法导入 ${src.repositoryId}@${sha}。请核对提交、仓库目录或网络后重试。`,
      { cause: err },
    );
  } finally {
    await rm(staging, { recursive: true, force: true });
    if (!kept) await rm(path.join(objects, marker), { recursive: true, force: true });
  }
}
export function snapshotPath(db: DatabaseSync, dir: string, repo: string, sha: string) {
  const row = db
    .prepare("SELECT generation FROM revision_store WHERE repository_id=? AND commit_sha=?")
    .get(repo, sha);
  requireThat(row, 422, "missing_revision", `请先导入 ${repo}@${sha}，再打开或发布该版课程。`);
  return path.join(dir, "repositories", String(row.generation));
}

export function checkPath(value: string, rootAllowed = false) {
  if (rootAllowed && value === "") return;
  requireThat(
    value.length > 0 &&
      value.length <= 4096 &&
      !/[\\:\x00-\x1f\x7f]/.test(value) &&
      value.split("/").every((s) => s !== "" && s !== "." && s !== ".."),
    400,
    "path",
    "路径必须是固定提交内的相对路径。",
  );
}
interface Item {
  mode: string;
  oid: string;
  name: string;
}
async function list(dir: string, tree: string, name?: string): Promise<Item[]> {
  const args = ["--literal-pathspecs", "ls-tree", "-z", tree];
  if (name !== undefined) args.push("--", name);
  const raw = (await git(dir, args)).toString("utf8");
  return raw
    .split("\0")
    .filter(Boolean)
    .map((row) => {
      const tab = row.indexOf("\t");
      const [mode, , oid] = row.slice(0, tab).split(" ");
      return { mode, oid, name: row.slice(tab + 1) };
    });
}
async function lookup(dir: string, sha: string, value: string): Promise<Item> {
  checkPath(value, true);
  let item = { mode: "040000", oid: sha, name: "" };
  if (!value) return item;
  for (const part of value.split("/")) {
    requireThat(item.mode === "040000", 422, "not_tree", "这个路径不是可浏览的目录。");
    const child = (await list(dir, item.oid, part)).find((x) => x.name === part);
    requireThat(child, 404, "missing_path", "固定提交中没有此路径，请返回目录树。");
    item = child;
  }
  return item;
}
export async function treePage(dir: string, sha: string, value: string, offset: number): Promise<TreePage> {
  const tree = await lookup(dir, sha, value);
  requireThat(tree.mode === "040000", 422, "not_tree", "请选择普通目录。");
  const rows = (await list(dir, tree.oid)).sort(
    (a, b) => Number(b.mode === "040000") - Number(a.mode === "040000") || a.name.localeCompare(b.name, "en"),
  );
  return {
    entries: rows
      .slice(offset, offset + 100)
      .map((x) => ({
        name: x.name,
        path: value ? value + "/" + x.name : x.name,
        kind: x.mode === "040000" ? "tree" : /^100(644|755)$/.test(x.mode) ? "file" : "other",
      })),
    next: offset + 100 < rows.length ? offset + 100 : null,
  };
}
export async function readFileAt(dir: string, sha: string, value: string): Promise<FileView> {
  checkPath(value);
  const obj = await lookup(dir, sha, value);
  requireThat(/^100(644|755)$/.test(obj.mode), 422, "not_file", "仅支持普通文件，链接与子模块不可读取。");
  const size = Number((await git(dir, ["cat-file", "-s", obj.oid])).toString().trim());
  const meta = { path: value, oid: obj.oid, size, content: null, lineCount: 0 };
  if (size > MAX_FILE) return { ...meta, reason: "文件超过 1 MiB 的阅读上限。" };
  const bytes = await git(dir, ["cat-file", "blob", obj.oid]);
  const oid = createHash(sha.length === 40 ? "sha1" : "sha256")
    .update("blob " + bytes.length + "\0")
    .update(bytes)
    .digest("hex");
  requireThat(oid === obj.oid, 422, "damaged_blob", objectMessage);
  let content: string;
  try {
    content = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/\r\n/g, "\n");
  } catch {
    return { ...meta, reason: "该文件不是 UTF-8 文本。" };
  }
  if (/[\r\0]/.test(content)) return { ...meta, reason: "二进制或孤立回车，无法定位源码行。" };
  const lines = content.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return { ...meta, content, lineCount: lines.length };
}
export function verifyExcerpt(file: FileView, evidence: Evidence) {
  const label = `${evidence.path}:${evidence.startLine}–${evidence.endLine}`;
  requireThat(
    file.content !== null && file.oid === evidence.blobOid,
    422,
    "blob_mismatch",
    label + " 文件摘要不符或不是受支持的文本。",
  );
  requireThat(
    evidence.startLine >= 1 && evidence.endLine >= evidence.startLine && evidence.endLine <= file.lineCount,
    422,
    "line_range",
    label + " 行号越界，请复核固定版本。",
  );
  const excerpt = file.content
    .split("\n")
    .slice(evidence.startLine - 1, evidence.endLine)
    .join("\n");
  requireThat(
    createHash("sha256").update(excerpt).digest("hex") === evidence.excerptSha256,
    422,
    "excerpt_mismatch",
    label + " 选区摘要不符，请重新核对引用。",
  );
  if (evidence.symbol)
    requireThat(
      excerpt.includes(evidence.symbol.split(".").at(-1)!),
      422,
      "symbol",
      label + " 缺少已声明的符号。",
    );
}
