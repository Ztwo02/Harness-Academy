import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import type { SymbolSearch } from "../shared/types";
import { Failure, Loading } from "./ui";
import { useData } from "./api";

export function SymbolNavigation({
  rid,
  from,
  seed,
  initialScope,
}: {
  rid: number;
  from: string;
  seed: { symbol: string; kind: "definition" | "reference" };
  initialScope: string;
}) {
  const [text, setText] = useState(seed.symbol),
    [query, setQuery] = useState({ ...seed, scope: initialScope }),
    [scope, setScope] = useState(initialScope);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setText(seed.symbol);
    setQuery({ ...seed, scope });
    if (seed.symbol) input.current?.focus();
  }, [seed]);
  const result = useData<SymbolSearch>(
    query.symbol ? `/releases/${rid}/symbols?` + new URLSearchParams(query) : null,
  );
  function search(e: FormEvent, kind: "definition" | "reference") {
    e.preventDefault();
    setQuery({ symbol: text.trim(), kind, scope: scope.trim() });
  }
  return (
    <section className="sheet symbol-navigation" aria-label="定义与引用导航">
      <h2>定义与引用候选</h2>
      <p>
        按固定版本源码检索文本。候选可能来自注释或同名符号，请核对上下文。编辑器中 F12
        查定义，Shift+F12 查引用。
      </p>
      <form className="symbol-form" onSubmit={(e) => search(e, "definition")}>
        <label>
          源码标识符
          <input
            ref={input}
            value={text}
            required
            maxLength={80}
            pattern="[A-Za-z_$][A-Za-z0-9_$]*"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <label>
          检索目录（留空查全仓）
          <input value={scope} maxLength={4096} onChange={(e) => setScope(e.target.value)} />
        </label>
        <button className="secondary">查找定义</button>
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => setQuery({ symbol: text.trim(), kind: "reference", scope: scope.trim() })}
        >
          查找引用
        </button>
      </form>
      {!query.symbol ? (
        <p>输入标识符，或在源码中将光标放到函数名后使用快捷键。</p>
      ) : result.error ? (
        <Failure text={result.error} />
      ) : !result.data ? (
        <Loading />
      ) : (
        <>
          <p className="search-scope">{result.data.scope}</p>
          <p role="status">
            {query.kind === "definition" ? "定义" : "引用"}候选 · {result.data.candidates.length} 项
            {result.data.truncated ? "（结果已截断，请用更具体的标识符）" : ""}
          </p>
          {!result.data.candidates.length && (
            <p>没有匹配候选。可换一个标识符，或回到章节的已核验证据。</p>
          )}
          <ul className="candidate-list">
            {result.data.candidates.map((c) => (
              <li key={c.path + c.line}>
                <Link
                  to={
                    `/releases/${rid}/source?` +
                    new URLSearchParams({
                      path: c.path,
                      start: String(c.line),
                      end: String(c.line),
                      from,
                    })
                  }
                >
                  <code>
                    {c.path}:{c.line}:{c.column}
                  </code>
                  <span>{c.kind === "definition" ? "声明候选" : "文本引用"}</span>
                </Link>
                <pre>{c.text}</pre>
                <small>{c.basis}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      <Link
        className="text-link"
        to={"/lab?" + new URLSearchParams({ releaseId: String(rid), lesson: from, q: text })}
      >
        用本地源码导师讲解这个符号
      </Link>
    </section>
  );
}
