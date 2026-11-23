import { useEffect, useState } from "react";

let session: Promise<string> | undefined;
async function token() {
  session ??= fetch("/api/session")
    .then(async (r) => {
      if (!r.ok) throw new Error("无法连接本地服务。");
      return (await r.json()).token as string;
    })
    .catch((e) => {
      session = undefined;
      throw e;
    });
  return session;
}
export async function api<T>(path: string, method = "GET", body?: unknown, retry = true): Promise<T> {
  const write = method !== "GET";
  const response = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: write ? { "Content-Type": "application/json", "X-Academy-Token": await token() } : {},
    body: write ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) {
    if (write && retry && data.code === "session") {
      session = undefined;
      return api(path, method, body, false);
    }
    throw new Error(data.message || "请求失败，请重试。");
  }
  return data as T;
}
export function useData<T>(path: string | null, revision = 0) {
  const [record, setRecord] = useState<{ path: string | null; data?: T; error?: string }>({ path: null });
  useEffect(() => {
    let alive = true;
    if (path)
      api<T>(path)
        .then((data) => {
          if (alive) setRecord({ path, data });
        })
        .catch((e) => {
          if (alive) setRecord({ path, error: message(e) });
        });
    return () => {
      alive = false;
    };
  }, [path, revision]);
  return path === record.path ? record : { path };
}
export function message(err: unknown) {
  return err instanceof Error ? err.message : "操作失败，请重试。";
}
