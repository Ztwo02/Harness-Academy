import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";
import { LabPlayer, type LabInput, type LabRun, type LabScenario } from "../shared/lab";
import type { Claim, Evidence, TutorCard } from "../shared/types";
import { api, message, useData } from "./api";
import { chapterUrl, evidenceUrl, Failure, Loading, PageTitle, useAcademy, Version } from "./ui";

interface TutorResponse {
  cards: TutorCard[];
  evidence: Record<string, Evidence>;
  notice: string;
}
const labels = {
  ready: "等待开始",
  paused: "已暂停",
  playing: "自动播放中",
  completed: "已完成，可重置重放",
};
const topicEvidence = { loop: "loop-control", tools: "tool-artifact", events: "agent-events" };
const topicLesson = { loop: "loop-control", tools: "tool-results", events: "events-state" };

function MockLab({ rid, mapped }: { rid: number; mapped: boolean }) {
  const [prompt, setPrompt] = useState("订单 42 发货了吗？"),
    [scenario, setScenario] = useState<LabScenario>("success");
  const player = useMemo(
    () => new LabPlayer({ prompt: "订单 42 发货了吗？", scenario: "success" }),
    [],
  );
  const [run, setRun] = useState<LabRun>(() => player.snapshot()),
    [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    const unsubscribe = player.subscribe(() => setRun(player.snapshot()));
    return () => {
      unsubscribe();
      player.dispose();
    };
  }, [player]);
  const [error, setError] = useState("");
  const event = run.events.find((e) => e.index === selected) ?? run.events.at(-1);
  const dirty = prompt !== run.input.prompt || scenario !== run.input.scenario;
  function reset(input?: LabInput) {
    try {
      player.reset(input);
      setSelected(null);
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <section className="lab-experiment">
      <div className="sheet lab-input">
        <h2>订单查询 Mock 实验</h2>
        <p>
          教学模拟：一个工具、两次固定模型答复。省略流式增量、并发、钩子、截断、取消与监听器结算；状态字段是教学抽象。不会执行导入的源码。
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            reset({ prompt, scenario });
          }}
        >
          <label>
            教学问题
            <input
              value={prompt}
              required
              maxLength={1000}
              onChange={(e) => {
                player.pause();
                setPrompt(e.target.value);
              }}
            />
          </label>
          <label>
            Mock 工具结果
            <select
              value={scenario}
              onChange={(e) => {
                player.pause();
                setScenario(e.target.value as LabScenario);
              }}
            >
              <option value="success">成功：订单已发货</option>
              <option value="error">异常：工具抛错</option>
              <option value="unknown-tool">异常：工具不存在</option>
            </select>
          </label>
          <button disabled={!dirty || !prompt.trim()}>应用输入并重置</button>
        </form>
        {dirty && <p role="status">输入已修改。应用输入后可开始新实验。</p>}
        {error && <Failure text={error} />}
      </div>
      <div className="lab-controls sheet">
        <div className="button-row">
          <button
            className="primary"
            disabled={dirty || run.status === "playing" || run.status === "completed"}
            onClick={() => player.step()}
          >
            <SkipForward size={16} />
            单步
          </button>
          {run.status === "playing" ? (
            <button onClick={() => player.pause()}>
              <Pause size={16} />
              暂停
            </button>
          ) : (
            <button disabled={dirty || run.status === "completed"} onClick={() => player.play()}>
              <Play size={16} />
              {run.cursor ? "继续播放" : "自动播放"}
            </button>
          )}
          <button onClick={() => reset()}>
            <RotateCcw size={16} />
            重置实验
          </button>
        </div>
        <p role="status">
          {labels[run.status]} · {run.cursor} / {run.total} 事件
        </p>
      </div>
      <div className="lab-grid">
        <section className="sheet event-panel">
          <h2>事件轨迹</h2>
          <p>选择事件查看当时的状态变化。</p>
          {!run.events.length ? (
            <p className="empty">点击“单步”观察第一个事件。</p>
          ) : (
            <ol className="event-list">
              {run.events.map((e) => (
                <li key={e.index}>
                  <button
                    aria-pressed={event?.index === e.index}
                    onClick={() => setSelected(e.index)}
                  >
                    <span>{e.index}</span>
                    <code>{e.type}</code>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="sheet state-panel">
          <h2>{event ? `事件 ${event.index} · ${event.type}` : "状态观察"}</h2>
          {event ? (
            <>
              <p>{event.detail}</p>
              <p className="mock-label">教学状态 · 此处只对照源码中的机制</p>
              <div className="state-diff">
                {(["before", "after"] as const).map((k) => (
                  <div key={k}>
                    <h3>{k === "before" ? "事件前" : "事件后"}</h3>
                    <pre>{JSON.stringify(event[k], null, 2)}</pre>
                  </div>
                ))}
              </div>
              {mapped ? (
                <Link
                  className="text-link"
                  to={evidenceUrl(
                    rid,
                    topicEvidence[event.sourceTopic],
                    topicLesson[event.sourceTopic],
                  )}
                >
                  核对机制对应的源码证据
                </Link>
              ) : (
                <p>本版没有深入章节映射；此事件仅为教学模拟。请更新本地教材。</p>
              )}
            </>
          ) : (
            <p>还没有事件。初始消息为空，单步和自动播放消费同一条确定性序列。</p>
          )}
        </section>
      </div>
      <details className="sheet">
        <summary>复现实验的输入与事件 JSON</summary>
        <pre className="run-json">
          {JSON.stringify(
            { format: "harness-mock-v1", input: run.input, events: run.events },
            null,
            2,
          )}
        </pre>
      </details>
    </section>
  );
}

function TutorClaims({
  claims,
  evidence,
  rid,
  lesson,
}: {
  claims: Claim[];
  evidence: Record<string, Evidence>;
  rid: number;
  lesson: string;
}) {
  return (
    <ul className="claims">
      {claims.map((c, i) => (
        <li key={i}>
          <span className="claim-kind">
            {{ fact: "源码事实", inference: "推断", advice: "建议" }[c.kind]}
          </span>
          {c.text}
          <div className="chips">
            {c.sourceRefs.map((key) => (
              <Link className="chip" key={key} to={evidenceUrl(rid, key, lesson)}>
                {evidence[key].symbol ?? key} · L{evidence[key].startLine}–{evidence[key].endLine}
              </Link>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
function Tutor({
  rid,
  lesson,
  initialQuery,
  projectId,
}: {
  rid: number;
  lesson: string;
  initialQuery: string;
  projectId: string;
}) {
  const [text, setText] = useState(initialQuery),
    [query, setQuery] = useState(initialQuery);
  const params = new URLSearchParams({ q: query });
  if (lesson) params.set("lesson", lesson);
  const result = useData<TutorResponse>(`/releases/${rid}/tutor?` + params);
  return (
    <>
      <form
        className="sheet tutor-search"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(text.trim());
        }}
      >
        <label>
          按符号、章节关键词或已收录的问题检索
          <input
            value={text}
            maxLength={160}
            placeholder={
              projectId === "codex"
                ? "例如 run_turn、工具、消息"
                : "例如 prepareToolCall、工具、agent_end"
            }
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="button-row">
          <button className="primary">查阅本地讲解</button>
          <button
            type="button"
            onClick={() => {
              setText("");
              setQuery("");
            }}
          >
            查看本章全部讲解
          </button>
        </div>
        <p>只查询已审稿教材，不生成新的源码结论。未覆盖的问题可回原章登记疑问。</p>
      </form>
      {result.error ? (
        <>
          <Failure text={result.error} />
          <Link to={"/repositories?project=" + projectId}>重新导入固定版本</Link>
        </>
      ) : !result.data ? (
        <Loading />
      ) : (
        <>
          <p role="status" className="notice">
            {result.data.notice}
          </p>
          {result.data.cards.map((card) => (
            <article className="lesson-paper tutor-card" key={card.lessonId}>
              <h2>{card.title}</h2>
              <p>{card.scenario}</p>
              {(
                [
                  ["职责与概念", card.responsibilities],
                  ["调用链", card.calls],
                  ["数据与执行流", card.dataFlow],
                ] as const
              ).map(([title, claims]) => (
                <section className="lesson-section" key={title}>
                  <h3>{title}</h3>
                  <TutorClaims
                    claims={claims}
                    evidence={result.data!.evidence}
                    rid={rid}
                    lesson={card.lessonId}
                  />
                </section>
              ))}
              <h3>已收录的问题</h3>
              {card.questions.map((q) => (
                <details key={q.question}>
                  <summary>{q.question}</summary>
                  <TutorClaims
                    claims={[q.answer]}
                    evidence={result.data!.evidence}
                    rid={rid}
                    lesson={card.lessonId}
                  />
                </details>
              ))}
              <Link className="text-link" to={chapterUrl(rid, card.lessonId)}>
                返回原章与练习
              </Link>
            </article>
          ))}
          {!result.data.cards.length && (
            <Link
              className="text-link"
              to={lesson ? chapterUrl(rid, lesson) + "#notebook" : "/projects/" + projectId}
            >
              返回课程登记疑问
            </Link>
          )}
        </>
      )}
    </>
  );
}

export function Lab() {
  const { projects, refresh } = useAcademy(),
    [params, setParams] = useSearchParams();
  const releaseOwner = projects.find((p) =>
    p.editions.some((e) => String(e.id) === params.get("releaseId")),
  );
  const project =
    releaseOwner ??
    projects.find((p) => p.projectId === params.get("projectId")) ??
    projects.find((p) => p.available) ??
    projects[0];
  const invalid =
    !project.available ||
    (params.has("releaseId") && !releaseOwner) ||
    (params.has("projectId") && params.get("projectId") !== project?.projectId);
  const editions = project?.editions ?? [];
  const edition = editions.find((e) => String(e.id) === params.get("releaseId")) ?? editions[0];
  const lesson = edition?.chapters.some((c) => c.id === params.get("lesson"))
    ? params.get("lesson")!
    : "";
  const mode = params.get("mode") === "mock" ? "mock" : "tutor";
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function set(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key === "releaseId") {
      next.delete("lesson");
      next.delete("q");
    }
    setParams(next);
  }
  async function update() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ releaseId: number }>("/bundled-releases", "POST", {
        projectId: project.projectId,
      });
      refresh();
      setParams({ releaseId: String(r.releaseId) });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (invalid)
    return (
      <>
        <PageTitle title="源码导师与实验" />
        <Failure text="找不到所选项目或版次，或项目与版次不匹配。请从原项目课程重新进入。" />
        <Link to="/">返回学习中心</Link>
      </>
    );
  return (
    <>
      <PageTitle
        title="源码导师与实验"
        description="从中文讲解回到固定版本源码，再用 Mock 观察一次完整过程。"
      >
        {edition && <Version sha={edition.commit} />}
      </PageTitle>
      {error && <Failure text={error} />}
      <div className="filters">
        <label>
          学习项目
          <select
            aria-label="学习项目"
            value={project.projectId}
            onChange={(e) => {
              setError("");
              setParams({ projectId: e.target.value });
            }}
          >
            {projects
              .filter((p) => p.available)
              .map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      {!edition ? (
        <section className="sheet empty">
          <h2>先导入 {project.name} 固定源码</h2>
          <p>本地导师和实验与课程一起使用。</p>
          <Link className="button primary" to={"/repositories?project=" + project.projectId}>
            导入项目源码
          </Link>
        </section>
      ) : (
        <>
          <div className="filters">
            <label>
              课程版次
              <select value={edition.id} onChange={(e) => set("releaseId", e.target.value)}>
                {editions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title} · v{e.version}
                  </option>
                ))}
              </select>
            </label>
            <label>
              带入章节
              <select
                value={lesson}
                onChange={(e) => {
                  const next = new URLSearchParams(params);
                  next.set("lesson", e.target.value);
                  next.delete("q");
                  setParams(next);
                }}
              >
                <option value="">全部章节</option>
                {edition.chapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            {project.projectId === "pi" &&
              !editions.some((e) => e.courseId === "pi-foundations" && e.version >= 2) && (
                <button disabled={busy} onClick={update}>
                  {busy ? "正在核验教材…" : "从已固定源码更新 Phase 2 教材"}
                </button>
              )}
          </div>
          <div className="tabs">
            <button aria-pressed={mode === "tutor"} onClick={() => set("mode", "tutor")}>
              本地源码导师
            </button>
            <button aria-pressed={mode === "mock"} onClick={() => set("mode", "mock")}>
              {project.projectId === "pi" ? "Mock 实验" : "Mock 实验（Pi）"}
            </button>
          </div>
          {mode === "tutor" ? (
            <Tutor
              key={edition.id + lesson + (params.get("q") ?? "")}
              rid={edition.id}
              lesson={lesson}
              initialQuery={params.get("q") ?? ""}
              projectId={project.projectId}
            />
          ) : project.projectId !== "pi" ? (
            <section className="sheet">
              <h2>本课程尚未提供对应 Mock 实验</h2>
              <p>当前订单 Mock 讲解 Pi 的循环机制。Codex 请通过本地导师与独立源码证据学习。</p>
              <button className="secondary" onClick={() => set("mode", "tutor")}>
                查看 Codex 本地导师
              </button>
            </section>
          ) : (
            <MockLab
              key={edition.id + lesson}
              rid={edition.id}
              mapped={
                edition.courseId === "pi-foundations" &&
                edition.version === 2 &&
                edition.commit === "08dc60bc52d89d6823a9738cc90b1916e5e446e5"
              }
            />
          )}
        </>
      )}
    </>
  );
}
