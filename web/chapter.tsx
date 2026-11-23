import { lazy, Suspense, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, ArrowUpRight, BookOpen, CheckCircle, Code2, FileCode2, NotebookPen } from "lucide-react";
import type { ChapterPage, Claim, PublicExercise, Review, State } from "../shared/types";
import { api, message, useData } from "./api";
import {
  Disclosure,
  evidenceUrl,
  Failure,
  Loading,
  PageTitle,
  ProgressState,
  useAcademy,
  useNarrow,
  Version,
} from "./ui";

function SourceChip({ page, id }: { page: ChapterPage; id: string }) {
  const e = page.evidence[id];
  return (
    <Link className="chip" to={evidenceUrl(page.releaseId, id, page.chapter.id)}>
      <Code2 size={12} />
      {e.symbol ?? e.path.split("/").at(-1)} · L{e.startLine}–{e.endLine}
    </Link>
  );
}
function Claims({ list, page }: { list: Claim[]; page: ChapterPage }) {
  return (
    <ul className="claims">
      {list.map((c, i) => (
        <li key={i}>
          <span className="claim-kind">
            {{ fact: "源码事实", inference: "推断", advice: "建议" }[c.kind]}
          </span>
          {c.text}
          <div className="chips">
            {c.sourceRefs.map((key) => (
              <SourceChip key={key} id={key} page={page} />
            ))}
            {c.materialRefs?.map((key) => (
              <a
                key={"material-" + key}
                className="chip"
                href={page.materials[key].url}
                target="_blank"
                rel="noreferrer"
              >
                补充资料 · {page.materials[key].locator}
                <ArrowUpRight size={12} />
              </a>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="lesson-section" id={id} tabIndex={-1}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Contents() {
  return (
    <nav className="contents" aria-label="本章导航">
      {[
        ["objectives", "学习目标"],
        ["concepts", "架构与概念"],
        ["source", "源码阅读"],
        ["execution", "执行流程"],
        ["exercises", "章节练习"],
        ["summary", "本章总结"],
        ["notebook", "本章记录"],
      ].map(([k, v]) => (
        <a key={k} href={"#" + k}>
          {v}
        </a>
      ))}
    </nav>
  );
}
function ExerciseView({ q, page }: { q: PublicExercise; page: ChapterPage }) {
  const { refresh } = useAcademy(),
    [answer, setAnswer] = useState(""),
    [grade, setGrade] = useState(""),
    [error, setError] = useState("");
  const [feedback, setFeedback] = useState<{ result: string; explanation: Claim } | null>(null),
    [busy, setBusy] = useState(false);
  const request = useRef<{ payload: string; key: string } | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const payload = JSON.stringify([answer, grade]);
    if (request.current?.payload !== payload) request.current = { payload, key: crypto.randomUUID() };
    try {
      const result = await api<{ result: string; explanation: Claim }>("/attempts", "POST", {
        releaseId: page.releaseId,
        lessonId: page.chapter.id,
        exerciseId: q.id,
        requestId: request.current.key,
        answer,
        ...(q.kind === "trace" ? { selfGrade: grade } : {}),
      });
      setFeedback(result);
      request.current = null;
      refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="exercise" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>{q.prompt}</legend>
        {q.kind === "single-choice" ? (
          q.options.map((o) => (
            <label className="choice" key={o.id}>
              <input
                type="radio"
                name={q.id}
                value={o.id}
                required
                checked={answer === o.id}
                onChange={() => {
                  setAnswer(o.id);
                  setFeedback(null);
                }}
              />
              {o.text}
            </label>
          ))
        ) : (
          <>
            <label>
              你的回答
              <textarea value={answer} required onChange={(e) => setAnswer(e.target.value)} />
            </label>
            <p>评分点：{q.rubric.join("；")}</p>
            <label>
              自评
              <select required value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">请选择</option>
                <option value="correct">已满足</option>
                <option value="incorrect">需要复习</option>
              </select>
            </label>
          </>
        )}
        <button className="primary" disabled={busy || !!feedback}>
          提交答案
        </button>
      </fieldset>
      {feedback && (
        <div role="status" className="feedback">
          <b>{feedback.result === "correct" ? "回答正确" : "已加入待复习错题"}</b>
          <Claims list={[feedback.explanation]} page={page} />
          <button
            type="button"
            className="subtle"
            onClick={() => {
              setAnswer("");
              setFeedback(null);
            }}
          >
            重新作答
          </button>
        </div>
      )}
      {error && <Failure text={error} />}
    </form>
  );
}
function Notebook({ page }: { page: ChapterPage }) {
  const { refresh, revision } = useAcademy();
  const notes = useData<Review>("/review?releaseId=" + page.releaseId, revision);
  const [kind, setKind] = useState<"note" | "question">("note"),
    [body, setBody] = useState(""),
    [evidence, setEvidence] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/entries", "POST", {
        releaseId: page.releaseId,
        lessonId: page.chapter.id,
        kind,
        body,
        evidenceId: evidence || null,
      });
      setBody("");
      setSaved(true);
      refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const entries = notes.data?.entries.filter((e) => e.lessonId === page.chapter.id) ?? [];
  return (
    <section className="sheet notebook" id="notebook">
      <h2>
        <NotebookPen size={17} />
        本章记录
      </h2>
      <form onSubmit={submit}>
        <div className="segmented">
          <button type="button" aria-pressed={kind === "note"} onClick={() => setKind("note")}>
            笔记
          </button>
          <button type="button" aria-pressed={kind === "question"} onClick={() => setKind("question")}>
            疑问
          </button>
        </div>
        <label>
          {kind === "note" ? "笔记内容" : "疑问内容"}
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSaved(false);
            }}
            required
            maxLength={16000}
            rows={4}
          />
        </label>
        <label>
          关联源码
          <select value={evidence} onChange={(e) => setEvidence(e.target.value)}>
            <option value="">整章</option>
            {page.chapter.sourceReading.map((id) => (
              <option key={id} value={id}>
                {page.evidence[id].symbol ?? id} · L{page.evidence[id].startLine}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary" disabled={busy || !body.trim()}>
          保存{kind === "note" ? "笔记" : "疑问"}
        </button>
        {error && <Failure text={error} />} {saved && <p role="status">已保存到本机。</p>}
      </form>
      {notes.error && <Failure text={notes.error} />}
      {entries.slice(0, 3).map((e) => (
        <p className="entry-preview" key={e.id}>
          <small>{e.kind === "note" ? "笔记" : "疑问"}</small>
          {e.body}
        </p>
      ))}
      {entries.length > 0 && (
        <Link to={"/review?releaseId=" + page.releaseId} className="text-link">
          查看学习记录
          <ArrowUpRight size={14} />
        </Link>
      )}
    </section>
  );
}
const FlowDiagram = lazy(() => import("./diagram"));
function LessonView({ page }: { page: ChapterPage }) {
  const l = page.chapter,
    loc = useLocation(),
    { refresh } = useAcademy();
  const narrow = useNarrow("(max-width:960px)");
  const [status, setStatus] = useState<State>(page.state),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const endpoint = `/releases/${page.releaseId}/lessons/${l.id}/progress`;
  useEffect(() => {
    let live = true;
    if (page.state === "unstarted")
      api<{ state: State }>(endpoint, "PUT", { state: "reading", opening: true })
        .then((r) => {
          if (live) {
            setStatus(r.state);
            refresh();
          }
        })
        .catch((e) => {
          if (live) setError(message(e));
        });
    return () => {
      live = false;
    };
  }, [endpoint]);
  useEffect(() => {
    if (!loc.hash) return;
    const target = document.getElementById(loc.hash.slice(1));
    if (target) {
      target.scrollIntoView();
      target.focus({ preventScroll: true });
    }
  }, [loc.hash]);
  async function toggle() {
    setBusy(true);
    try {
      const r = await api<{ state: State }>(endpoint, "PUT", {
        state: status === "completed" ? "reading" : "completed",
      });
      setStatus(r.state);
      refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Link to={"/projects/" + page.projectId + "?edition=" + page.releaseId} className="back">
        <ArrowLeft size={15} />
        项目知识地图
      </Link>
      <PageTitle title={l.title} description={page.title + " · v" + page.version}>
        <ProgressState state={status} />
      </PageTitle>
      {narrow && (
        <Disclosure label="本章目录">
          <Contents />
        </Disclosure>
      )}
      <div className="lesson-grid">
        <article className="lesson-paper">
          <div className="lesson-version">
            <span>
              <FileCode2 size={16} />
              {page.repositoryId}
            </span>
            <Version sha={page.commit} />
          </div>
          <Section title="学习目标" id="objectives">
            <ul>
              {l.objectives.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Section>
          <Section title="前置知识" id="basics">
            <p>{l.priorKnowledge.join(" ")}</p>
          </Section>
          <Section title="架构与概念" id="concepts">
            <Claims list={l.concepts} page={page} />
            {page.projectId === "pi" &&
              page.commit === "08dc60bc52d89d6823a9738cc90b1916e5e446e5" &&
              l.id === "agent-loop" &&
              page.evidence.entry?.symbol === "agentLoop" && (
                <Suspense fallback={<Loading />}>
                  <FlowDiagram />
                </Suspense>
              )}
          </Section>
          <Section title="业务场景" id="scenario">
            <p>{l.scenario}</p>
          </Section>
          <Section title="源码阅读" id="source">
            <div className="source-list">
              {l.sourceReading.map((id) => {
                const e = page.evidence[id];
                return (
                  <Link key={id} id={"cite-" + id} to={evidenceUrl(page.releaseId, id, l.id)}>
                    <FileCode2 size={17} />
                    <span>
                      <b>{e.symbol ?? e.path.split("/").at(-1)}</b>
                      <small>{e.path}</small>
                    </span>
                    <code>
                      L{e.startLine}–{e.endLine}
                    </code>
                    <ArrowUpRight size={15} />
                  </Link>
                );
              })}
            </div>
          </Section>
          <Section title="关键函数" id="symbols">
            <div className="chips">
              {l.keySymbols.map((s, i) => (
                <SourceChip key={i} page={page} id={s.sourceRef} />
              ))}
            </div>
          </Section>
          <Section title="执行流程" id="execution">
            <Claims list={l.execution} page={page} />
          </Section>
          <Section title="调用关系" id="calls">
            <Claims list={l.calls} page={page} />
          </Section>
          <Section title="设计原因" id="rationale">
            <Claims list={l.designRationale} page={page} />
          </Section>
          <Section title="常见问题" id="faq">
            {l.faq.map((f, i) => (
              <details key={i}>
                <summary>{f.question}</summary>
                <Claims list={[f.answer]} page={page} />
              </details>
            ))}
          </Section>
          <Section title="章节练习" id="exercises">
            {l.exercises.map((q) => (
              <ExerciseView key={q.id} q={q} page={page} />
            ))}
          </Section>
          <Section title="本章总结" id="summary">
            <Claims list={l.summary} page={page} />
            <button className="primary" disabled={busy} onClick={toggle}>
              <CheckCircle size={16} />
              {status === "completed" ? "重新打开章节" : "标记本章完成"}
            </button>
            {error && <Failure text={error} />}
          </Section>
        </article>
        <aside className="chapter-tools">
          {!narrow && (
            <section className="sheet">
              <h2>
                <BookOpen size={17} />
                本章导航
              </h2>
              <Contents />
            </section>
          )}
          <Notebook page={page} />
        </aside>
      </div>
    </>
  );
}
export function Chapter() {
  const { rid, lesson } = useParams();
  const result = useData<ChapterPage>(`/releases/${rid}/lessons/${lesson}`);
  if (result.error) return <Failure text={result.error} />;
  if (!result.data) return <Loading />;
  return <LessonView page={result.data} />;
}
