import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowUpRight, BookOpen, Check, CircleHelp, NotebookPen, RotateCcw } from "lucide-react";
import type { Review } from "../shared/types";
import { api, message, useData } from "./api";
import { chapterUrl, evidenceUrl, Failure, Loading, PageTitle, useAcademy } from "./ui";

const tabs = [
  ["notes", "笔记"],
  ["questions", "疑问"],
  ["mistakes", "待复习错题"],
  ["history", "作答历史"],
] as const;
export function Records() {
  const { projects, revision, refresh } = useAcademy(),
    [query, setQuery] = useSearchParams();
  const tab = query.get("tab") ?? "notes",
    rid = query.get("releaseId") ?? "",
    project = query.get("projectId") ?? "";
  const filters = new URLSearchParams();
  if (rid) filters.set("releaseId", rid);
  if (project) filters.set("projectId", project);
  const result = useData<Review>("/review?" + filters, revision);
  const [err, setErr] = useState(""),
    [busy, setBusy] = useState<number | null>(null);
  function set(k: string, v: string) {
    const next = new URLSearchParams(query);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k === "projectId") next.delete("releaseId");
    setQuery(next);
  }
  const rows = (result.data?.entries ?? []).filter((e) => e.kind === (tab === "notes" ? "note" : "question"));
  const attempts = (result.data?.attempts ?? []).filter(
    (a) => tab === "history" || (a.latest && a.result === "incorrect"),
  );
  const study = tab === "notes" || tab === "questions";
  async function resolve(id: number, resolved: boolean) {
    setBusy(id);
    try {
      await api("/entries/" + id, "PATCH", { resolved });
      setErr("");
      refresh();
    } catch (e) {
      setErr(message(e));
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <PageTitle title="学习记录" description="按课程版本查看笔记、疑问与每一次作答。" />
      <div className="filters">
        <label>
          项目
          <select value={project} onChange={(e) => set("projectId", e.target.value)}>
            <option value="">全部项目</option>
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          课程版次
          <select value={rid} onChange={(e) => set("releaseId", e.target.value)}>
            <option value="">全部版次</option>
            {projects
              .filter((p) => !project || p.projectId === project)
              .flatMap((p) => p.editions)
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} · v{e.version}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="tabs">
        {tabs.map(([k, l]) => (
          <button key={k} aria-pressed={k === tab} onClick={() => set("tab", k)}>
            {l}
          </button>
        ))}
      </div>
      {err && <Failure text={err} />}
      {result.error ? (
        <Failure text={result.error} />
      ) : !result.data ? (
        <Loading />
      ) : (
        <section className="sheet records">
          {study
            ? rows.map((e) => (
                <article key={e.id}>
                  <div className="record-meta">
                    <span>
                      {e.kind === "note" ? <NotebookPen size={14} /> : <CircleHelp size={14} />}{" "}
                      {e.kind === "note" ? "笔记" : e.resolved ? "已解决" : "待解疑问"} · v{e.version}
                    </span>
                    <time>{e.updatedAt} UTC</time>
                  </div>
                  <p>{e.body}</p>
                  <Link
                    className="text-link"
                    to={
                      e.evidenceId
                        ? evidenceUrl(e.releaseId, e.evidenceId, e.lessonId)
                        : chapterUrl(e.releaseId, e.lessonId) + "#notebook"
                    }
                  >
                    {e.lessonTitle}
                    <ArrowUpRight size={14} />
                  </Link>
                  {e.kind === "question" && (
                    <button
                      className="subtle"
                      disabled={busy === e.id}
                      onClick={() => resolve(e.id, !e.resolved)}
                    >
                      {e.resolved ? "重新打开" : "标记已解决"}
                    </button>
                  )}
                </article>
              ))
            : attempts.map((a) => (
                <article key={a.id}>
                  <div className="record-meta">
                    <span>
                      {a.result === "correct" ? <Check size={15} /> : <RotateCcw size={15} />}{" "}
                      {a.result === "correct" ? "正确" : "答错"} · v{a.version}
                    </span>
                    <time>{a.createdAt} UTC</time>
                  </div>
                  <h3>{a.prompt}</h3>
                  <p>你的答案 · {a.answer}</p>
                  <Link className="text-link" to={chapterUrl(a.releaseId, a.lessonId) + "#exercises"}>
                    返回原题
                    <ArrowUpRight size={14} />
                  </Link>
                </article>
              ))}
          {(study ? !rows.length : !attempts.length) && (
            <div className="empty">
              <BookOpen />
              <h3>
                {tab === "mistakes"
                  ? "当前没有待复习错题"
                  : "此范围内暂无" + (tabs.find((x) => x[0] === tab)?.[1] ?? "记录")}
              </h3>
              <p>阅读章节时可以保存笔记、登记疑问并作答。</p>
              <Link className="text-link" to="/projects/pi">
                查看 Pi 课程
                <ArrowUpRight size={15} />
              </Link>
            </div>
          )}
        </section>
      )}
    </>
  );
}
