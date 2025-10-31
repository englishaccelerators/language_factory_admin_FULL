// src/shared/storage.ts
export const REASONS_LS = "lf.reasons.v1";
export const ACTIVE_REASON_LS = "lf.activeReason.v1";

export const readJSON = <T,>(k: string, fb: T): T => {
  try {
    const t = localStorage.getItem(k);
    return t ? (JSON.parse(t) as T) : fb;
  } catch {
    return fb;
  }
};

export const writeJSON = (k: string, v: any) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

export const LS_FOR = (slug: string) => ({
  catalog:  `lf.${slug}.catalog.v1`,
  sequences:`lf.${slug}.sequences.v1`,
  entry:    `lf.${slug}.entry.blocks.v1`,
});

/** Create a download (CSV, XLS, MD, etc.). Works in StackBlitz & browsers. */
export function downloadBlob(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  // Legacy Edge/IE
  // @ts-ignore
  if (window.navigator?.msSaveOrOpenBlob) {
    try { /* @ts-ignore */ window.navigator.msSaveOrOpenBlob(blob, name); return { ok: true }; } catch {}
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener"; a.target = "_self";
  document.body.appendChild(a);
  let ok = true; try { a.click(); } catch { ok = false; try { window.open(url, "_blank"); } catch {} }
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  return { ok };
}
