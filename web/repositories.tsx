import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileJson,
  Folder,
  GitBranch,
  Github,
  LoaderCircle,
} from "lucide-react";
import { api, message } from "./api";
import { Failure, PageTitle, useAcademy, Version } from "./ui";
import type { ImportJob, Project } from "../shared/types";

function ImportForm({ source }: { source: Project }) {
  const { refresh } = useAcademy();
  const [kind, setKind] = useState<"github" | "directory">("github"),
    [url, setUrl] = useState(source.url),
    [folder, setFolder] = useState("");
  const [commit, setCommit] = useState(source.baselineCommit),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const jobKey = "academy-import-" + source.repositoryId;
  const [job, setJob] = useState<ImportJob | null>(() => {
    const id = sessionStorage.getItem(jobKey);
    return id ? { id, status: "working", message: "正在恢复任务状态…" } : null;
  });
  const busy = saving || job?.status === "working";
  useEffect(() => {
    if (job?.status !== "working") return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const next = await api<ImportJob>("/imports/" + job!.id);
        if (!alive) return;
        setJob(next);
        if (next.status === "working") timer = setTimeout(poll, 650);
        else {
          sessionStorage.removeItem(jobKey);
          refresh();
        }
      } catch (e) {
        if (alive) {
          setError(message(e));
          setJob(null);
          sessionStorage.removeItem(jobKey);
        }
      }
    }
    void poll();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [job?.id, job?.status]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const next = await api<ImportJob>("/imports", "POST", {
        repositoryId: source.repositoryId,
        kind,
        locator: kind === "github" ? url : folder,
        commit,
      });
      sessionStorage.setItem(jobKey, next.id);
      setJob(next);
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="sheet form-sheet" onSubmit={submit}>
      <h2>
        <Download size={19} />
        导入固定版本
      </h2>
      <fieldset disabled={busy}>
        <legend>来源</legend>
        <div className="segmented">
          <button type="button" aria-pressed={kind === "github"} onClick={() => setKind("github")}>
            <Github size={16} />
            GitHub
          </button>
          <button type="button" aria-pressed={kind === "directory"} onClick={() => setKind("directory")}>
            <Folder size={16} />
            本机目录
          </button>
        </div>
        {kind === "github" ? (
          <label>
            GitHub 仓库地址
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)} />
          </label>
        ) : (
          <label>
            本机 Git 仓库的绝对路径
            <input
              required
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="D:\\Repositories\\pi-mono"
              spellCheck={false}
            />
            <small>可以使用工作树或裸仓库；只导入已提交的文件。</small>
          </label>
        )}
        <label>
          完整 Commit SHA
          <input
            className="mono"
            required
            pattern="[0-9a-f]{40}|[0-9a-f]{64}"
            value={commit}
            onChange={(e) => setCommit(e.target.value)}
            spellCheck={false}
          />
          <small>
            {source.phase === 1
              ? "首章对应下方基线提交。导入后会自动核对并发布 Pi 架构导读。"
              : "此项目已登记，课程将在 Phase " + source.phase + " 开放。"}
          </small>
        </label>
        <button disabled={busy} className="primary">
          {busy ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}{" "}
          {busy ? "正在导入" : "开始导入"}
        </button>
      </fieldset>
      {error && <Failure text={error} />}
      {job?.status === "failed" ? (
        <Failure text={job.message} />
      ) : (
        job && (
          <div role="status" className="notice">
            {job.status === "done" ? <CheckCircle2 size={17} /> : <LoaderCircle size={17} className="spin" />}
            {job.message}
          </div>
        )
      )}
      {job?.releaseId && (
        <Link className="text-link" to={"/projects/" + source.projectId + "?edition=" + job.releaseId}>
          打开项目课程
          <ArrowRight size={15} />
        </Link>
      )}
    </form>
  );
}
function PublishForm() {
  const { refresh } = useAcademy(),
    [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(""),
    [result, setResult] = useState<number>(),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setResult(undefined);
    setBusy(true);
    try {
      if (file.size > 2 * 1024 ** 2) throw new Error("课程文件超过 2 MiB。");
      // Preserve raw JSON so the server can detect duplicate property names.
      const { token } = await api<{ token: string }>("/session");
      const r = await fetch("/api/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Academy-Token": token },
        body: await file.text(),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.message);
      setResult(b.releaseId);
      refresh();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="sheet publish">
      <summary>
        <FileJson size={18} />
        发布本地课程包
      </summary>
      <form onSubmit={submit}>
        <label>
          已审稿的课程 JSON
          <input
            type="file"
            accept=".json,application/json"
            required
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(undefined);
            }}
          />
        </label>
        <button className="secondary" disabled={busy}>
          验证并发布
        </button>
        {error && <Failure text={error} />}
        {result && (
          <Link className="text-link" to={"/projects/pi?edition=" + result}>
            已发布，查看课程
            <ArrowRight size={15} />
          </Link>
        )}
      </form>
    </details>
  );
}
export function Repositories() {
  const { projects } = useAcademy(),
    [query, setQuery] = useSearchParams();
  const source = projects.find((p) => p.projectId === query.get("project")) ?? projects[0];
  return (
    <>
      <PageTitle title="仓库管理" description="选择来源，将课程对应的 Git 提交保存在本机。" />
      <div className="repo-tabs" aria-label="仓库选择">
        {projects.map((p) => (
          <button
            aria-pressed={p === source}
            key={p.projectId}
            onClick={() => setQuery({ project: p.projectId })}
          >
            {p.name}
          </button>
        ))}
      </div>
      <div className="two-col">
        <ImportForm key={source.repositoryId} source={source} />
        <section className="sheet source-details">
          <h2>
            <GitBranch size={18} />
            来源详情
          </h2>
          <dl>
            <dt>已登记仓库</dt>
            <dd>
              <code>{source.url.replace("https://github.com/", "")}</code>
            </dd>
            <dt>课程基线</dt>
            <dd className="full-sha">{source.baselineCommit}</dd>
            <dt>本地已固定</dt>
            <dd>
              {source.revisions.length
                ? source.revisions.map((sha) => <Version key={sha} sha={sha} />)
                : "尚未导入"}
            </dd>
          </dl>
          {source.editions.length > 0 && (
            <Link className="text-link" to={"/projects/" + source.projectId}>
              查看已发布课程
              <ArrowRight size={15} />
            </Link>
          )}
        </section>
      </div>
      {source.phase === 1 && <PublishForm />}
    </>
  );
}
