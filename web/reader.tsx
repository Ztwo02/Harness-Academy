import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  FileCode2,
  Folder,
  Link2,
  ListTree,
} from "lucide-react";
import type { Backlink, Evidence, FileView, TreePage } from "../shared/types";
import { useData } from "./api";
import { SymbolNavigation } from "./navigation";
import {
  chapterUrl,
  Disclosure,
  Failure,
  Loading,
  PageTitle,
  useAcademy,
  useNarrow,
  Version,
} from "./ui";

const EditorPane = lazy(() => import("./editor"));
function parent(p: string) {
  return p.split("/").slice(0, -1).join("/");
}
function Tree({
  rid,
  initial,
  select,
}: {
  rid: number;
  initial: string;
  select: (p: string) => void;
}) {
  const narrow = useNarrow("(max-width:700px)");
  const [dir, setDir] = useState(parent(initial)),
    [offset, setOffset] = useState(0);
  useEffect(() => {
    setDir(parent(initial));
    setOffset(0);
  }, [initial]);
  const result = useData<TreePage>(
    `/releases/${rid}/tree?` + new URLSearchParams({ path: dir, offset: String(offset) }),
  );
  function move(next: string) {
    setOffset(0);
    setDir(next);
  }
  const listing = (
    <aside className="file-tree">
      {!narrow && (
        <h2>
          <ListTree size={17} />
          目录树
        </h2>
      )}
      <nav aria-label="文件目录" className="tree-crumb">
        <button onClick={() => move("")}>根目录</button>
        {dir
          .split("/")
          .filter(Boolean)
          .map((part, i) => (
            <span key={i}>
              {" "}
              /{" "}
              <button
                onClick={() =>
                  move(
                    dir
                      .split("/")
                      .slice(0, i + 1)
                      .join("/"),
                  )
                }
              >
                {part}
              </button>
            </span>
          ))}
      </nav>
      {result.error ? (
        <Failure text={result.error} />
      ) : !result.data ? (
        <Loading />
      ) : (
        <>
          <ul>
            {result.data.entries.map((item) => (
              <li key={item.name}>
                <button
                  className={item.path === initial ? "selected" : ""}
                  disabled={item.kind === "other"}
                  onClick={() => (item.kind === "tree" ? move(item.path) : select(item.path))}
                  title={item.kind === "other" ? "链接或子模块" : item.path}
                >
                  {item.kind === "tree" ? <Folder size={16} /> : <FileCode2 size={16} />}
                  <span>{item.name}</span>
                  {item.kind === "tree" && <ChevronRight size={12} />}
                </button>
              </li>
            ))}
          </ul>
          {(offset > 0 || result.data.next !== null) && (
            <div className="paging">
              <button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 100))}>
                上一页
              </button>
              <button
                disabled={result.data.next === null}
                onClick={() => setOffset(result.data!.next!)}
              >
                下一页
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
  return narrow ? <Disclosure label="文件目录">{listing}</Disclosure> : listing;
}
function SourceView({
  rid,
  file,
  evidence,
  from,
  eid,
  start,
  end,
  select,
}: {
  rid: number;
  file: FileView;
  evidence?: Evidence;
  from: string;
  eid: string;
  start: number;
  end: number;
  select: (p: string) => void;
}) {
  const [range, setRange] = useState([start, end]);
  const [symbol, setSymbol] = useState<{ symbol: string; kind: "definition" | "reference" }>({
    symbol: "",
    kind: "definition",
  });
  const result = useData<Backlink[]>(
    `/releases/${rid}/backlinks?` +
      new URLSearchParams({ path: file.path, start: String(range[0]), end: String(range[1]) }),
  );
  return (
    <>
      <div className="reader-grid">
        <Tree rid={rid} initial={file.path} select={select} />
        <section className="code-pane">
          <header>
            <FileCode2 size={16} />
            <code>{file.path}</code>
            <span>{(file.size / 1024).toFixed(1)} KiB</span>
          </header>
          {file.content === null ? (
            <div className="empty">
              <FileCode2 />
              <h3>文件元数据</h3>
              <p>{file.reason}</p>
              <code className="full-sha">{file.oid}</code>
            </div>
          ) : (
            <Suspense fallback={<Loading />}>
              <EditorPane
                file={file}
                start={start}
                end={end}
                change={(a, b) => setRange([a, b])}
                navigate={(word, kind) => {
                  setSymbol({ symbol: word, kind });
                  document.getElementById("symbol-navigation")?.scrollIntoView({ block: "start" });
                }}
              />
            </Suspense>
          )}
          <footer>
            <span>{file.lineCount} 行</span>
            <span>
              选区 L{range[0]}–{range[1]}
            </span>
          </footer>
        </section>
      </div>
      <div id="symbol-navigation">
        <SymbolNavigation rid={rid} from={from} seed={symbol} initialScope={parent(file.path)} />
      </div>
      <div className="two-col reader-bottom">
        <section className="sheet">
          <h2>
            <Link2 size={18} />
            选区关联章节
          </h2>
          {result.error ? (
            <Failure text={result.error} />
          ) : !result.data ? (
            <Loading />
          ) : result.data.length ? (
            result.data.map((link) => (
              <Link
                className="backlink"
                key={link.lessonId + link.evidenceId}
                to={chapterUrl(rid, link.lessonId) + "#cite-" + link.evidenceId}
              >
                <span>{link.title}</span>
                <code>
                  L{link.startLine}–{link.endLine}
                </code>
                <ArrowRight size={15} />
              </Link>
            ))
          ) : (
            <p>此选区暂无课程引用。</p>
          )}
        </section>
        <section className="sheet">
          <h2>
            <CheckCircle2 size={18} />
            {evidence ? "已核验的证据" : "文件版本"}
          </h2>
          {evidence && (
            <p>
              <b>{evidence.symbol ?? file.path}</b> · L{start}–{end}
            </p>
          )}
          <details>
            <summary>查看对象摘要</summary>
            <dl>
              <dt>Git blob</dt>
              <dd className="full-sha">{file.oid}</dd>
              {evidence && (
                <>
                  <dt>选区 SHA-256</dt>
                  <dd className="full-sha">{evidence.excerptSha256}</dd>
                </>
              )}
            </dl>
          </details>
          {from && (
            <Link
              className="text-link"
              to={chapterUrl(rid, from) + (eid ? "#cite-" + eid : "#source")}
            >
              返回原章
              <ArrowRight size={15} />
            </Link>
          )}
        </section>
      </div>
    </>
  );
}
export default function Reader() {
  const { rid } = useParams(),
    [query, setQuery] = useSearchParams(),
    { projects } = useAcademy();
  const project = projects.find((p) => p.editions.some((e) => e.id === Number(rid)));
  const edition = project?.editions.find((e) => e.id === Number(rid));
  const eid = query.get("evidence") ?? "",
    name = query.get("path") ?? "",
    from = query.get("from") ?? edition?.chapters[0]?.id ?? "";
  const resource = useData<FileView | { file: FileView; evidence: Evidence }>(
    eid
      ? `/releases/${rid}/evidence/${encodeURIComponent(eid)}`
      : name
        ? `/releases/${rid}/file?` + new URLSearchParams({ path: name })
        : null,
  );
  const select = (path: string) => setQuery({ path, from });
  const payload = resource.data;
  const file = payload && ("file" in payload ? payload.file : payload);
  const evidence = payload && "evidence" in payload ? payload.evidence : undefined;
  const clamp = (n: string | null) =>
    Math.min(Math.max(1, Math.trunc(Number(n)) || 1), Math.max(1, file?.lineCount ?? 1));
  const start = evidence?.startLine ?? clamp(query.get("start")),
    end = evidence?.endLine ?? Math.max(start, clamp(query.get("end")));
  return (
    <>
      {from && (
        <Link
          className="back"
          to={chapterUrl(Number(rid), from) + (eid ? "#cite-" + eid : "#source")}
        >
          <ArrowLeft size={15} />
          返回章节
        </Link>
      )}
      <PageTitle
        title="源码阅读器"
        description={edition ? edition.title + " · v" + edition.version : undefined}
      >
        {edition && (
          <div>
            <Version sha={edition.commit} />
            {eid && from && (
              <Link
                className="text-link"
                to={
                  `/learn/${project!.projectId}/${edition.courseId}/${edition.version}/${from}?` +
                  new URLSearchParams({ evidence: eid })
                }
              >
                固定版次链接
                <Link2 size={12} />
              </Link>
            )}
          </div>
        )}
      </PageTitle>
      {resource.error ? (
        <>
          <Failure text={resource.error} />
          <p>
            <Link
              className="text-link"
              to={"/repositories?" + new URLSearchParams({ project: project?.projectId ?? "" })}
            >
              重新导入固定版本
              <ArrowRight size={15} />
            </Link>
          </p>
          <Tree rid={Number(rid)} initial="" select={select} />
        </>
      ) : file ? (
        <SourceView
          key={JSON.stringify([rid, eid, name, start, end])}
          rid={Number(rid)}
          file={file}
          evidence={evidence}
          from={from}
          eid={eid}
          start={start}
          end={end}
          select={select}
        />
      ) : eid || name ? (
        <Loading />
      ) : (
        <Tree rid={Number(rid)} initial="" select={select} />
      )}
    </>
  );
}
