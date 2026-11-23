import { execFile } from "node:child_process";
import type { DatabaseSync } from "node:sqlite";
import { getLesson, getRelease } from "./courses.ts";
import { requireThat, Problem } from "./base.ts";
import { readFileAt, snapshotPath, sourceCorpus, verifyExcerpt } from "./git.ts";
import type { SymbolCandidate, SymbolSearch, TutorCard } from "../shared/types.ts";

export async function findSymbol(
  db: DatabaseSync,
  dataDir: string,
  rid: number,
  symbol: string,
  kind: "definition" | "reference",
  scope = "",
): Promise<SymbolSearch> {
  requireThat(
    /^[A-Za-z_$][A-Za-z0-9_$]{0,79}$/.test(symbol),
    400,
    "symbol",
    "请输入一个最多 80 字符的源码标识符。",
  );
  const course = getRelease(db, rid),
    dir = snapshotPath(db, dataDir, course.repositoryId, course.commit);
  const files = await sourceCorpus(dir, course.commit, scope);
  const lines: { path: string; line: number; text: string }[] = [];
  for (const file of files)
    file.content.split("\n").forEach((text, i) => {
      lines.push({ path: file.path, line: i + 1, text });
    });
  if (!lines.length)
    return {
      symbol,
      candidates: [],
      truncated: false,
      scope: `${course.repositoryId}@${course.commit} · ${scope || "全仓"} · 没有受支持的普通源码文本`,
    };
  // Fixed strings and stdin: neither the symbol nor repository paths become shell syntax or rg options.
  const matches = await new Promise<string>((resolve, reject) => {
    const child = execFile(
      "rg",
      ["--no-config", "--json", "--fixed-strings", "--max-count", "501", "--", symbol, "-"],
      { timeout: 10000, maxBuffer: 8 * 1024 ** 2, windowsHide: true },
      (err, stdout) => {
        if (err && (err as { code?: unknown }).code !== 1)
          reject(
            new Problem(
              422,
              "search",
              "本地符号检索失败，请确认 ripgrep 可用。仍可使用课程证据定位。",
            ),
          );
        else resolve(stdout);
      },
    );
    child.stdin?.on("error", () => {});
    child.stdin?.end(lines.map((l) => l.text).join("\n"));
  });
  const candidates: SymbolCandidate[] = [];
  let matchedLines = 0;
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const definition = new RegExp(
    "(?:\\b(?:function|fn|struct|trait|mod|class|interface|type|enum|const|let|var)\\s+(?:mut\\s+)?" +
      escaped +
      "(?=[^\\w$]|$)|(?:^|\\s)(?:(?:private|public|protected|static|async|export)\\s+)*" +
      escaped +
      "\\s*\\([^;]*\\)\\s*(?::[^;{]+)?\\s*\\{)",
  );
  for (const row of matches.split("\n").filter(Boolean)) {
    const item = JSON.parse(row);
    if (item.type !== "match") continue;
    matchedLines++;
    const source = lines[item.data.line_number - 1];
    const positions = [...source.text.matchAll(new RegExp(escaped, "g"))].filter((m) => {
      const i = m.index!;
      return (
        !/[\w$]/.test(source.text[i - 1] ?? "") &&
        !/[\w$]/.test(source.text[i + symbol.length] ?? "")
      );
    });
    if (!positions.length) continue;
    const isDefinition = definition.test(source.text);
    if (kind === "definition" && !isDefinition) continue;
    candidates.push({
      ...source,
      text: source.text.trim().slice(0, 300),
      column: positions[0].index! + 1,
      kind: isDefinition ? "definition" : "reference",
      basis: isDefinition
        ? "声明/方法文本模式命中；可能含同名或注释"
        : "标识符文本命中；可能含注释、字符串或同名符号",
    });
  }
  return {
    symbol,
    candidates: candidates.slice(0, 100),
    truncated: matchedLines >= 501 || candidates.length > 100,
    scope: `${course.repositoryId}@${course.commit} · ${scope || "全仓"} · 普通 TS/JS/Rust/Python 文本；不提供语言级绑定保证`,
  };
}

export async function tutor(
  db: DatabaseSync,
  dataDir: string,
  rid: number,
  lessonId?: string,
  query = "",
) {
  const course = getRelease(db, rid);
  const lessons = lessonId ? [getLesson(course, lessonId)] : course.lessons;
  const normalized = query.trim().toLowerCase();
  const cards: TutorCard[] = lessons
    .filter(
      (l) =>
        !normalized ||
        [l.title, ...l.keySymbols.map((s) => s.name), ...l.faq.map((f) => f.question)].some(
          (text) => text.toLowerCase().includes(normalized),
        ),
    )
    .map((l) => ({
      lessonId: l.id,
      title: l.title,
      symbols: l.keySymbols.map((s) => s.name),
      responsibilities: l.concepts,
      calls: l.calls,
      dataFlow: l.execution,
      scenario: l.scenario,
      questions: l.faq,
    }));
  const dir = snapshotPath(db, dataDir, course.repositoryId, course.commit);
  const refs = new Set(
    cards.flatMap((card) =>
      [
        ...card.responsibilities,
        ...card.calls,
        ...card.dataFlow,
        ...card.questions.map((q) => q.answer),
      ].flatMap((c) => c.sourceRefs),
    ),
  );
  for (const key of refs) {
    const e = course.sourceEvidence[key];
    verifyExcerpt(await readFileAt(dir, course.commit, e.path), e);
  }
  return {
    cards,
    evidence: course.sourceEvidence,
    commit: course.commit,
    version: course.version,
    notice: cards.length
      ? "本地已审稿课程摘编；结论保留事实、推断和建议标记。"
      : "现有教材没有覆盖这个符号或问题，请在原章登记待验证疑问。",
  };
}
