import { lazy, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import {
  BookOpen,
  ChevronRight,
  FolderGit2,
  Layers3,
  LibraryBig,
  Menu,
  Monitor,
  NotebookPen,
  PanelLeftClose,
} from "lucide-react";
import { useData } from "./api";
import { Academy, chapterUrl, evidenceUrl, Failure, Loading, useAcademy } from "./ui";
import type { Project } from "../shared/types";
import { Home, ProjectPage } from "./projects";
import { Repositories } from "./repositories";
import { Chapter } from "./chapter";
import { Records } from "./records";
import "./style.css";

const Reader = lazy(() => import("./reader"));
function PortableChapter() {
  const { project, course, version, lesson } = useParams();
  const { projects } = useAcademy();
  const { search } = useLocation();
  const edition = projects
    .find((p) => p.projectId === project)
    ?.editions.find((e) => e.courseId === course && String(e.version) === version);
  if (!lesson || !edition?.chapters.some((l) => l.id === lesson))
    return (
      <>
        <Failure text="本机尚未发布此版章节，请先导入对应源码及课程包。" />
        <Link to="/repositories">仓库管理</Link>
      </>
    );
  const key = new URLSearchParams(search).get("evidence");
  return (
    <Navigate replace to={key ? evidenceUrl(edition.id, key, lesson) : chapterUrl(edition.id, lesson)} />
  );
}
function Shell() {
  const [revision, setRevision] = useState(0),
    [menu, setMenu] = useState(false);
  const { data: projects, error } = useData<Project[]>("/projects", revision);
  const loc = useLocation();
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  const section = loc.pathname.startsWith("/repositories")
    ? "仓库管理"
    : loc.pathname.startsWith("/review")
      ? "学习记录"
      : "学习中心";
  const leaf = loc.pathname.endsWith("/source")
    ? "源码阅读器"
    : loc.pathname.includes("/lessons/")
      ? "课程阅读"
      : loc.pathname.startsWith("/projects/")
        ? "项目课程"
        : null;
  return (
    <div className="shell">
      <a className="skip" href="#main">
        跳至正文
      </a>
      <aside className={"rail" + (menu ? " open" : "")}>
        <Link to="/" className="brand" aria-label="Harness Academy 首页">
          <span className="brand-symbol">
            <Layers3 size={23} />
          </span>
          <span>
            Harness <b>Academy</b>
          </span>
        </Link>
        <nav aria-label="主导航">
          <NavLink end to="/" className={() => (section === "学习中心" ? "active" : "")}>
            <LibraryBig />
            学习中心
          </NavLink>
          <NavLink to="/repositories">
            <FolderGit2 />
            仓库管理
          </NavLink>
          <NavLink to="/review">
            <NotebookPen />
            学习记录
          </NavLink>
        </nav>
        <div className="rail-foot">
          <Monitor size={17} />
          <div>
            <strong>本地工作区</strong>
            <small>Harness Academy · v0.1</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="mobile-toggle"
            aria-label={menu ? "关闭导航" : "打开导航"}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <PanelLeftClose /> : <Menu />}
          </button>
          <div className="crumb">
            <BookOpen size={16} />
            <span>工作台</span>
            <ChevronRight size={13} />
            <Link to={section === "学习中心" ? "/" : loc.pathname}>{section}</Link>
            {leaf && (
              <>
                <ChevronRight size={13} />
                <strong>{leaf}</strong>
              </>
            )}
          </div>
          <span className="local">
            <i />
            本地模式
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          {error ? (
            <>
              <Failure text={error} />
              <button onClick={() => setRevision((n) => n + 1)}>重新连接</button>
            </>
          ) : !projects ? (
            <Loading />
          ) : (
            <Academy.Provider value={{ projects, revision, refresh: () => setRevision((n) => n + 1) }}>
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/projects/:id" element={<ProjectPage />} />
                  <Route path="/repositories" element={<Repositories />} />
                  <Route path="/review" element={<Records />} />
                  <Route path="/learn/:project/:course/:version/:lesson" element={<PortableChapter />} />
                  <Route path="/releases/:rid/lessons/:lesson" element={<Chapter key={loc.pathname} />} />
                  <Route path="/releases/:rid/source" element={<Reader key={loc.pathname} />} />
                  <Route
                    path="*"
                    element={
                      <>
                        <Failure text="没有找到这个页面。" />
                        <Link to="/">返回学习中心</Link>
                      </>
                    }
                  />
                </Routes>
              </Suspense>
            </Academy.Provider>
          )}
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <Shell />
  </BrowserRouter>,
);
