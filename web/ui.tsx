import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Circle,
  CircleDot,
  GitCommitHorizontal,
  LoaderCircle,
} from "lucide-react";
import type { Edition, Project, State, UnverifiedQuestion } from "../shared/types";

export const sourceLabels = { "public-repo": "公开仓库", "sdk-repo": "官方 SDK", "official-doc": "官方文档" };
export function PendingQuestions({ questions }: { questions: UnverifiedQuestion[] }) {
  if (!questions.length) return null;
  return <section className="sheet pending-questions" aria-label="内部机制待验证问题">
    <h2>内部机制：待验证问题</h2>
    <p>以下内容尚无本课程可验证的内部实现证据，不作为源码事实或调用链。</p>
    {questions.map(q => <details key={q.id}><summary>{q.question}</summary><p>{q.reason}</p><p>所需证据：{q.verificationNeeded}</p></details>)}
  </section>;
}

export const Academy = createContext<{ projects: Project[]; refresh: () => void; revision: number }>({
  projects: [],
  refresh: () => {},
  revision: 0,
});
export function useAcademy() {
  return useContext(Academy);
}
export function useNarrow(query: string) {
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return narrow;
}
export function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false),
    id = useId(),
    trigger = useRef<HTMLButtonElement>(null);
  return (
    <div
      className="disclosure"
      onKeyDown={(e) => {
        if (open && e.key === "Escape") {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {label}
        <ChevronRight size={15} />
      </button>
      <div
        id={id}
        hidden={!open}
        onClick={(event) => {
          if ((event.target as Element).closest("a[href^='#']")) setOpen(false);
        }}
      >
        {children}
      </div>
    </div>
  );
}
export const stateLabels: Record<State, string> = {
  unstarted: "未开始",
  reading: "学习中",
  completed: "已完成",
};
export function ProgressState({ state }: { state: State }) {
  const Icon = state === "completed" ? Check : state === "reading" ? CircleDot : Circle;
  return (
    <span className="state">
      <Icon size={14} />
      {stateLabels[state]}
    </span>
  );
}
export function counts(edition?: Edition) {
  const total = edition?.chapters.length ?? 0,
    done = edition?.chapters.filter((l) => l.state === "completed").length ?? 0;
  return { total, done, percent: total ? Math.round((done * 100) / total) : 0 };
}
export function Loading() {
  return (
    <p className="notice" role="status">
      <LoaderCircle className="spin" size={17} />
      正在读取本地数据…
    </p>
  );
}
export function Failure({ text }: { text: string }) {
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={18} />
      <span>{text}</span>
    </div>
  );
}
export function PageTitle({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  useEffect(() => {
    document.title = title + " · Harness Academy";
  }, [title]);
  return (
    <header className="page-title">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </header>
  );
}
export function Version({ sha }: { sha: string }) {
  const [copyState, setCopyState] = useState("");
  return (
    <details className="version">
      <summary>
        <GitCommitHorizontal size={15} />
        <code>{sha.slice(0, 8)}</code>
        <ChevronRight size={12} />
      </summary>
      <code className="full-sha">{sha}</code>
      <button
        type="button"
        className="subtle"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(sha);
            setCopyState("已复制");
          } catch {
            setCopyState("请选择上方完整 SHA 复制");
          }
        }}
      >
        复制 SHA
      </button>{" "}
      <span role="status">{copyState}</span>
    </details>
  );
}
export function chapterUrl(rid: number, lesson: string) {
  return `/releases/${rid}/lessons/${lesson}`;
}
export function evidenceUrl(rid: number, key: string, lesson: string) {
  return `/releases/${rid}/source?` + new URLSearchParams({ evidence: key, from: lesson });
}
