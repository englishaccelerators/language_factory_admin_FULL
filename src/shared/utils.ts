import { PLACEHOLDER } from "./constants";

export const uniqArray = <T,>(a:T[]) => Array.from(new Set(a));
export const pathsEqual = (a:string[], b:string[]) => a.length === b.length && a.every((x,i)=>x===b[i]);

export function catalogMap(catalog: Array<{bKey:string; bVal?:string; cVal?:string}>) {
  const m = new Map<string, any>(); (catalog||[]).forEach(r => m.set(r.bKey, r)); return m;
}
export function bToken(bKey: string, byBKey: Map<string, any>) {
  const rec = byBKey.get(bKey); return rec && rec.bVal ? rec.bVal : bKey;
}
export function humanLabel(bKey: string, byBKey: Map<string, any>) {
  const rec = byBKey.get(bKey); if (!rec) return bKey; return rec.cVal || rec.bVal || bKey;
}
export const parseWords = (s: string) => String(s||"").split(/[\n,]+/).map(x=>x.trim()).filter(Boolean);

// ---------- Entry helpers ----------
export const isFilledOutput = (v:any) => {
  if (v === undefined || v === null) return false;
  const s = String(v).trim();
  if (!s) return false;
  if (s.toLowerCase() === PLACEHOLDER) return false;
  return true;
};
export const shouldExportRow = (output:any) => isFilledOutput(output);
export const exportValueFor = (output:any) => (isFilledOutput(output) ? output : "");

export function buildExcelHtml(header: string[], rows: string[][]) {
  const esc = (s:string) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const thead = `<tr>${header.map(h=>`<th>${esc(h)}</th>`).join("")}</tr>`;
  const tbody = rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c??"")}</td>`).join("")}</tr>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="Content-Type" content="application/vnd.ms-excel; charset=UTF-8"></head><body><table>${thead}${tbody}</table></body></html>`;
}
