// src/shared/api.ts
export const API = {
  /**
   * Where to send data when you click "Save":
   * - "LOCAL_ONLY" ⇒ no server required; we’ll save to local storage and download a CSV
   * - Or set this to your server URL, e.g. "http://localhost:8000"
   */
  BASE: "LOCAL_ONLY", // change to "http://localhost:8000" when you run the server
  LANGUAGE: "en",
  TENANT: "kids-english",
};

export async function apiJson(
  path: string,
  body: any,
  method: "POST" | "PUT" = "POST"
) {
  if (API.BASE === "LOCAL_ONLY") {
    // In offline mode we don't actually call a server.
    // We throw so the caller knows to fallback to local save.
    throw new Error("LOCAL_ONLY");
  }

  const res = await fetch(`${API.BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${method} ${path} ${res.status}: ${text || res.statusText}`);
  }
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** ---------- Simple local queue helpers (used in LOCAL_ONLY mode) ---------- */
const QUEUE_KEY = "lf.upload.queue.v1";

export function queueRead(): any[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function queuePush(batch: any) {
  const all = queueRead();
  all.push(batch);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(all));
}

export function queueClear() {
  localStorage.removeItem(QUEUE_KEY);
}

/** Download text as a .csv file in the browser */
export function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.reuseObjectURL?.(url);
}
