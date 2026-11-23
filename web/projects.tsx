import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Boxes,
  Braces,
  Check,
  ChevronRight,
  FileCode2,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  Layers3,
  LockKeyhole,
  Map,
  Route,
  Sparkles,
  Terminal,
} from "lucide-react";
import { chapterUrl, counts, Failure, PageTitle, ProgressState, useAcademy, Version, sourceLabels } from "./ui";
import type { Project } from "../shared/types";

const names: Record<string, string> = {
  pi: "Pi Agent Harness",
  codex: "OpenAI Codex CLI",
  deepseek: "DeepSeek Harness",
  claude: "Claude Code",
};
const topics: Record<string, string> = {
  pi: "Agent 运行时与事件流",
  codex: "命令行编码助手",
  deepseek: "插件架构、模型 step 与原生工具结果",
  claude: "公开仓库与官方 SDK",
};
const icons = { pi: Boxes, codex: Terminal, deepseek: GitBranch, claude: Sparkles };
function ProjectIcon({ id }: { id: string }) {
  const I = icons[id as keyof typeof icons] ?? Braces;
  return (
    <span className={"project-icon " + id}>
      <I size={22} />
    </span>
  );
}
function Progress({ value }: { value: number }) {
  return (
    <span
      className="meter"
      role="meter"
      aria-label="章节完成率"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <i style={{ width: value + "%" }} />
    </span>
  );
}

function PiPanel({ pi }: { pi: Project }) {
  const edition = pi.editions.find((e) => e.courseId === "pi-foundations"),
    { done, total, percent } = counts(edition);
  const active = edition?.chapters.find((ch) => ch.state === "reading");
  const start =
    active && edition
      ? chapterUrl(edition.id, active.id)
      : edition
        ? "/projects/pi?edition=" + edition.id
        : "/repositories?project=pi";
  return (
    <article className="pi-panel">
      <div className="pi-body">
        <div className="pi-name">
          <span className="pi-mark">π</span>
          <h2>Pi Agent Harness</h2>
        </div>
        <p>从输入消息到 Agent Loop</p>
        <div className="pi-meta">
          <span>
            <BookOpen size={14} />
            {total || 1} 章
          </span>
          <span>
            <GitCommitHorizontal size={16} />
            <code>{(edition?.commit ?? pi.baselineCommit).slice(0, 8)}</code>
          </span>
        </div>
        <Link className="hero-action" to={start}>
          {active ? "继续学习" : edition ? "进入课程" : "导入 Pi 源码"}
          <ArrowRight size={17} />
        </Link>
      </div>
      <div className="flow-preview" aria-label="Pi 源码调用顺序：agentLoop、runAgentLoop、runLoop">
        <div className="flow-file">
          <FileCode2 size={14} />
          agent-loop.ts
        </div>
        <div className="flow-step">
          <i />
          <code>agentLoop</code>
          <small>L32</small>
        </div>
        <div className="flow-step inset">
          <i />
          <code>runAgentLoop</code>
          <small>L96</small>
        </div>
        <div className="flow-step twice">
          <i />
          <code>runLoop</code>
          <small>L156</small>
        </div>
      </div>
      <div className="pi-progress">
        <span>课程进度</span>
        <Progress value={percent} />
        <b>{percent}%</b>
        <span>
          {done} / {total || 1} 章
        </span>
      </div>
    </article>
  );
}
export function Home() {
  const { projects } = useAcademy(),
    pi = projects.find((x) => x.projectId === "pi")!;
  const edition = pi.editions.find((e) => e.courseId === "pi-foundations"),
    chapters = edition?.chapters ?? [];
  const steps = [
    {
      label: "导入固定版本",
      text: "保留可离线读取的源码",
      ready: pi.revisions.includes(pi.baselineCommit),
      to: "/repositories?project=pi",
    },
    {
      label: "阅读 Pi 架构导读",
      text: "从章节定位到真实函数",
      ready: chapters.some((l) => l.state !== "unstarted"),
      to: "/projects/pi",
    },
    {
      label: "完成章节练习",
      text: "作答、记笔记并回顾错题",
      ready: chapters.length > 0 && chapters.every((l) => l.state === "completed"),
      to: edition ? chapterUrl(edition.id, chapters[0].id) + "#exercises" : "/projects/pi",
    },
  ];
  return (
    <>
      <PageTitle title="学习中心" description="查看项目进度，沿着固定版本的源码开始学习。">
        <Link to="/repositories" className="button secondary">
          <FolderGit2 size={16} />
          仓库管理
        </Link>
      </PageTitle>
      <div className="dashboard">
        <section className="project-index">
          <div className="section-head">
            <h2>学习项目</h2>
            <span>{projects.length} 个项目</span>
          </div>
          <PiPanel pi={pi} />
          <div className="project-rows">
            {projects
              .filter((x) => x.projectId !== "pi")
              .map((p) => (
                <Link className="project-row" key={p.projectId} to={"/projects/" + p.projectId}>
                  <ProjectIcon id={p.projectId} />
                  <span className="project-row-text">
                    <strong>{names[p.projectId]}</strong>
                    <small>{topics[p.projectId]}</small>
                  </span>
                  <span className="planned">
                    {p.available ? <BookOpen size={12} /> : <LockKeyhole size={12} />}
                    {p.available
                      ? p.editions[0]
                        ? `${counts(p.editions[0]).done} / ${counts(p.editions[0]).total} 章`
                        : "可导入学习"
                      : "待开放"}
                  </span>
                  <span className="phase">Phase {p.phase}</span>
                  <ChevronRight size={16} />
                </Link>
              ))}
          </div>
        </section>
        <aside className="dashboard-aside">
          <section className="guide">
            <div className="section-head">
              <h2>Pi 学习路径</h2>
              <Route size={18} />
            </div>
            <ol className="steps">
              {steps.map((s, i) => (
                <li
                  key={s.label}
                  className={
                    s.ready ? "done" : i === steps.findIndex((x) => !x.ready) ? "current" : ""
                  }
                >
                  <span className="step-marker">{s.ready ? <Check size={13} /> : i + 1}</span>
                  <Link to={s.to}>
                    <b>{s.label}</b>
                    <small>{s.text}</small>
                  </Link>
                </li>
              ))}
            </ol>
            <Link className="text-link" to="/projects/pi">
              查看知识地图
              <ArrowRight size={15} />
            </Link>
          </section>
          <section className="journal-link">
            <span className="journal-symbol">
              <BookOpen size={21} />
            </span>
            <h2>学习记录</h2>
            <p>回到笔记、未解疑问和错题所在的章节。</p>
            <Link to="/review" className="text-link">
              打开记录
              <ArrowUpRight size={14} />
            </Link>
          </section>
        </aside>
      </div>
    </>
  );
}
export function ProjectPage() {
  const { projects } = useAcademy(),
    { id } = useParams(),
    [query, setQuery] = useSearchParams();
  const p = projects.find((s) => s.projectId === id);
  if (!p) return <Failure text="未找到这个学习项目。" />;
  const edition = p.editions.find((e) => e.id === Number(query.get("edition"))) ?? p.editions[0];
  return (
    <>
      <PageTitle title={names[p.projectId] ?? p.name} description={topics[p.projectId]}>
        <ProjectIcon id={p.projectId} />
      </PageTitle>
      {p.projectId === "claude" && <section className="sheet source-scope">
        <h2>按来源学习</h2><p>公开示例、官方 SDK 客户端与官方文档分别核验；二进制内部机制保留为待验证问题。</p>
        <div className="button-row">{p.repositories.map(r => <Link className="button" key={r.repositoryId} to={"/repositories?" + new URLSearchParams({ project: p.projectId, repository: r.repositoryId })}>导入{sourceLabels[r.sourceKind ?? "public-repo"]}</Link>)}<Link className="button" to="/materials/claude">官方文档阅读卡</Link></div>
      </section>}
      <section className="sheet">
        {p.projectId === "deepseek" && (
          <p className="notice">
            内置课程沿固定公开版本的 headless 新会话与原生工具路径学习。
            各章注明资料缺口；模型服务端内部、其他 profile 与平台安全实测不在本课范围。
          </p>
        )}
        <div className="section-head project-map-head">
          <h2>
            <Map size={19} />
            知识地图
          </h2>
          {edition && (
            <label>
              课程版次{" "}
              <select value={edition.id} onChange={(e) => setQuery({ edition: e.target.value })}>
                {p.editions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {p.repositories.length > 1 ? sourceLabels[e.sourceKind] + " · " : ""}{e.title} · v{e.version}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {edition ? (
          <>
            <p className="inline-meta">
              {edition.title} · {counts(edition).done} / {edition.chapters.length} 章完成
            </p>
            <Version sha={edition.commit} />
            {p.repositories.length > 1 && <p className="inline-meta">{sourceLabels[edition.sourceKind]} · {edition.repositoryId}</p>}
            {edition.chapters.map((l, i) => (
              <Link className="chapter-line" key={l.id} to={chapterUrl(edition.id, l.id)}>
                <span className="chapter-no">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <b>{l.title}</b>
                  <small>
                    {l.prerequisiteLessons.length
                      ? "前置章节：" +
                        l.prerequisiteLessons
                          .map((k) => edition.chapters.find((c) => c.id === k)?.title)
                          .join("、")
                      : "起点 · 无前置章节"}
                  </small>
                </span>
                <ProgressState state={l.state} />
                <ArrowRight size={17} />
              </Link>
            ))}
          </>
        ) : (
          <div className="empty">
            <Layers3 />
            <h3>{p.available ? "导入源码，开始学习" : "课程将在 Phase " + p.phase + " 开放"}</h3>
            <p>
              {p.available
                ? "导入登记的课程基线提交，自动核对并发布本项目教材。"
                : "已登记公开仓库与固定版本，可在仓库管理中查看来源。"}
            </p>
            <Link to={"/repositories?project=" + p.projectId} className="button primary">
              {p.available ? "导入 " + (names[p.projectId] ?? p.name) + " 源码" : "查看来源"}
              <ArrowRight size={15} />
            </Link>
          </div>
        )}
      </section>
    </>
  );
}
