import { createHash, randomUUID } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { parseJson, Problem, requireThat, root } from "./base.ts";

const text = z.string().trim().min(1).max(16000);
const sha = z.string().regex(/^[a-f0-9]{64}$/);
export const readingCardSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/), version: z.number().int().positive().safe(),
  projectId: z.literal("claude"), sourceKind: z.literal("official-doc"), title: text,
  url: z.enum(["https://code.claude.com/docs/en/agent-sdk/overview.md", "https://code.claude.com/docs/en/hooks-guide.md"]),
  accessedAt: z.iso.datetime(), sha256: sha, locator: text, excerpt: text, excerptSha256: sha,
  summary: z.array(text).min(1), questions: z.array(text).min(1),
}).strict();
export type ReadingCard = z.infer<typeof readingCardSchema>;
export const readingCards = z.array(readingCardSchema).parse(parseJson(readFileSync(path.join(root, "materials/claude/cards.v1.json"), "utf8")));
const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
function boundedFile(filename: string): Buffer {
  try {
    const stat = lstatSync(filename);
    requireThat(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 1024 ** 2, 422, "material_snapshot", "资料快照不是受支持的普通文件或超过 1 MiB。");
    return readFileSync(filename);
  } catch (e) {
    if (e instanceof Problem) throw e;
    throw new Problem(422, "material_snapshot", "本地资料快照缺失，请重新导入该阅读卡。");
  }
}
export function verifyReading(card: ReadingCard, bytes: Buffer) {
  readingCardSchema.parse(card);
  requireThat(hash(bytes) === card.sha256, 422, "material_snapshot", "官方资料快照摘要不符，请按原版重新导入。");
  let body: string;
  try { body = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw new Problem(422, "material_snapshot", "官方资料快照不是 UTF-8 文本。"); }
  // The excerpt must occur after the named heading; an unrelated occurrence is insufficient.
  const lines = body.replaceAll("\r\n", "\n").split("\n");
  const heading = lines.indexOf(card.locator);
  const section = lines.slice(heading + 1).join("\n").split(/\n#{1,6} /)[0];
  requireThat(heading >= 0 && section.includes(card.excerpt) &&
    hash(card.excerpt) === card.excerptSha256, 422, "material_locator", "快照中的标题、段落或选区摘要不符。");
  return body;
}
function manifestPath(dataDir: string, id: string, version: number) {
  requireThat(/^[a-z][a-z0-9-]*$/.test(id) && Number.isSafeInteger(version) && version > 0, 400, "reading", "阅读卡标识无效。");
  return path.join(dataDir, "readings", `${id}.v${version}.json`);
}
export function getReading(dataDir: string, id: string, version: number) {
  const filename = manifestPath(dataDir, id, version);
  requireThat(existsSync(filename), 404, "reading", "尚未导入此版阅读卡，请返回官方资料列表。");
  const card = readingCardSchema.parse(parseJson(boundedFile(filename).toString("utf8")));
  requireThat(card.id === id && card.version === version, 422, "material_snapshot", "阅读卡身份与本地记录不符。");
  const body = verifyReading(card, boundedFile(path.join(dataDir, "materials", card.sha256)));
  return { card, body };
}
function atomicWrite(filename: string, bytes: Buffer | string) {
  const temp = filename + "." + randomUUID() + ".tmp";
  writeFileSync(temp, bytes, { flag: "wx", mode: 0o600 });
  renameSync(temp, filename);
}
export function installReading(dataDir: string, id: string, version: number) {
  const filename = manifestPath(dataDir, id, version);
  const card = readingCards.find(c => c.id === id && c.version === version);
  requireThat(card, 404, "reading", "应用没有提供此版官方阅读卡。");
  const bytes = boundedFile(path.join(root, "materials/claude", card.sha256 + ".txt"));
  verifyReading(card, bytes);
  mkdirSync(path.join(dataDir, "readings"), { recursive: true });
  mkdirSync(path.join(dataDir, "materials"), { recursive: true });
  if (existsSync(filename))
    requireThat(isDeepStrictEqual(parseJson(boundedFile(filename).toString("utf8")), card), 409, "reading_conflict", "同版阅读卡记录不同，保留旧版；请使用新版本。");
  atomicWrite(path.join(dataDir, "materials", card.sha256), bytes);
  if (!existsSync(filename)) atomicWrite(filename, JSON.stringify(card));
  return card;
}
export function listReadings(dataDir: string) {
  return readingCards.map(card => {
    let state: "unimported" | "ready" | "damaged" = "unimported";
    if (existsSync(manifestPath(dataDir, card.id, card.version))) {
      try { getReading(dataDir, card.id, card.version); state = "ready"; }
      catch { state = "damaged"; }
    }
    return { ...card, state };
  });
}
