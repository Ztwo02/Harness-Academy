import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, message, useData } from "./api";
import { Failure, Loading, PageTitle } from "./ui";
import type { ReadingCard } from "../server/readings";

type CardStatus = ReadingCard & { state: "unimported" | "ready" | "damaged" };
export function Readings() {
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(""), [error, setError] = useState("");
  const result = useData<CardStatus[]>("/reading-cards", revision);
  async function install(card: CardStatus) {
    setBusy(card.id); setError("");
    try { await api("/reading-cards/import", "POST", { id: card.id, version: card.version }); setRevision(n => n + 1); }
    catch (e) { setError(message(e)); } finally { setBusy(""); }
  }
  return <>
    <Link className="back" to="/projects/claude">返回 Claude 项目</Link>
    <PageTitle title="官方文档阅读卡" description="固定已抓取的官方响应；导入后可断网复读，正文按纯文本展示。" />
    {error && <Failure text={error} />}
    {result.error ? <Failure text={result.error} /> : !result.data ? <Loading /> : !result.data.length ? <p className="sheet">尚无已核对的官方阅读卡。</p> : result.data.map(card => <section className="sheet reading-row" key={card.id + card.version}>
      <h2>{card.title}</h2>
      <p>官方文档 · v{card.version} · {card.state === "ready" ? "已核验本地快照" : card.state === "damaged" ? "快照缺失或损坏" : "尚未导入本地资料库"}</p>
      <p className="inline-meta">抓取时间：{card.accessedAt}</p>
      <p>{card.url}</p>
      <div className="button-row">{card.state === "ready" ? <Link className="button primary" to={`/materials/claude/${card.id}/${card.version}`}>阅读固定快照</Link> : <button className="primary" disabled={!!busy} onClick={() => install(card)}>{busy === card.id ? "正在核验…" : card.state === "damaged" ? "从应用内快照修复" : "导入已核对快照"}</button>}</div>
    </section>)}
  </>;
}
export function Reading() {
  const { card, version } = useParams();
  const result = useData<ReadingCard>(`/reading-cards/${card}/${version}`);
  return <>
    <Link className="back" to="/materials/claude">返回官方文档阅读卡</Link>
    {result.error ? <Failure text={result.error} /> : !result.data ? <Loading /> : <>
      <PageTitle title={result.data.title} description={`官方文档 · v${result.data.version} · 已核验本地快照`} />
      <article className="lesson-paper reading-paper">
        <h2>公开说明与适用范围</h2>
        {result.data.summary.map(t => <p key={t}>{t}</p>)}
        <h2>快照中的定位段落（节选）</h2>
        <p>{result.data.locator}</p><blockquote>{result.data.excerpt}…</blockquote>
        <p>此段只代表抓取时公开文档的说明；页面或 SDK 升级后须另取快照、另行核对，不当作内部源码事实。</p>
        <h2>来源与复核</h2>
        <dl><dt>官方 URL</dt><dd><a href={result.data.url} target="_blank" rel="noreferrer">{result.data.url}</a></dd>
          <dt>抓取时间</dt><dd>{result.data.accessedAt}</dd><dt>原始响应 SHA-256</dt><dd className="full-sha">{result.data.sha256}</dd>
          <dt>段落选区 SHA-256</dt><dd className="full-sha">{result.data.excerptSha256}</dd></dl>
        <a className="button secondary" href={`/api/reading-cards/${card}/${version}/snapshot`} target="_blank" rel="noreferrer">查看本地原始响应（纯文本）</a>
        <h2>尚需核对的问题</h2><ul>{result.data.questions.map(t => <li key={t}>{t}</li>)}</ul>
      </article>
    </>}
  </>;
}
