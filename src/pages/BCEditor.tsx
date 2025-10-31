import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button, Input } from "@shared/ui";
import { LS_FOR, readJSON, writeJSON } from "@shared/storage";
import { catalogMap, parseWords } from "@shared/utils";

/** === NEW ===
 * Optional API base. If your API is same-origin, leave it blank.
 * If it's elsewhere (e.g. http://localhost:8787), set VITE_STAGE1_API in your .env.
 */
const API_BASE = (import.meta as any)?.env?.VITE_STAGE1_API?.trim?.() ?? "";

/** Minimal fetch wrapper */
async function api(path: string, init?: RequestInit) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  return res.json();
}

/** Debounce helper so we don't spam the server while typing */
function useDebounce(fn: (...a: any[]) => void, ms: number) {
  const t = useRef<number | null>(null);
  return (...a: any[]) => {
    if (t.current) window.clearTimeout(t.current);
    // @ts-ignore
    t.current = window.setTimeout(() => fn(...a), ms);
  };
}

export default function BCEditor({ slug }: { slug: string }) {
  const LS = LS_FOR(slug);

  const [caseSensitive, setCaseSensitive] = useState(false);
  const [enforceNoMatch, setEnforceNoMatch] = useState(true);
  const [start, setStart] = useState(1);
  const [perPage, setPerPage] = useState(200);

  // === CHANGED: initialize from server if possible (fallback to LS)
  const [catalog, setCatalog] = useState<any[]>(() => readJSON(LS.catalog, []));

  // on first mount, try to fetch server copy
  useEffect(() => {
    (async () => {
      try {
        const r = await api(`/stage1/bc:get?reason=${encodeURIComponent(slug)}`);
        if (r?.ok && Array.isArray(r.items)) {
          setCatalog(r.items);
          writeJSON(LS.catalog, r.items); // keep local fallback
        }
      } catch {
        // no server? we silently use localStorage
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // keep LS mirror updated
  useEffect(() => writeJSON(LS.catalog, catalog), [catalog, LS.catalog]);

  const byBKey = useMemo(() => catalogMap(catalog), [catalog]);

  const usedSet = useMemo(() => {
    const norm = (v: string) => (caseSensitive ? v : String(v || "").toLowerCase());
    const s = new Set<string>();
    (catalog || []).forEach((r) => {
      if (r?.bVal) s.add(norm(r.bVal));
      if (r?.cVal) s.add(norm(r.cVal));
    });
    return s;
  }, [catalog, caseSensitive]);

  // === NEW: save to server (debounced)
  const saveServer = useDebounce(async (items: any[]) => {
    try {
      const r = await api("/stage1/bc:save", {
        method: "POST",
        body: JSON.stringify({ reason: slug, items }),
      });
      if (!r?.ok) {
        // optional toast; we silently ignore to avoid blocking typing
        console.warn("bc:save failed:", r?.error);
      }
    } catch (e) {
      console.warn("bc:save error:", e);
    }
  }, 600);

  function updateVal(bKey: string, which: "bVal" | "cVal", val: string) {
    setCatalog((prev) => {
      const a = Array.isArray(prev) ? prev.slice() : [];
      const idx = a.findIndex((r: any) => r.bKey === bKey);
      const cKey = `column C-${bKey.split(" ")[1]}`;
      const row = idx >= 0 ? { ...a[idx] } : { bKey, bVal: "", cKey, cVal: "" };

      const norm = (v: string) => (caseSensitive ? v : String(v || "").toLowerCase());
      const currentUsed = new Set(usedSet);
      if (row.bVal) currentUsed.delete(norm(row.bVal));
      if (row.cVal) currentUsed.delete(norm(row.cVal));

      const nextRow = { ...row, [which]: val };
      if (enforceNoMatch && nextRow.bVal && nextRow.cVal && norm(nextRow.bVal) === norm(nextRow.cVal)) {
        alert("value-1 and value-2 cannot be the same.");
        return prev;
      }
      if (val && currentUsed.has(norm(val))) {
        alert("This value already exists across B/C.");
        return prev;
      }

      if (idx >= 0) a[idx] = nextRow;
      else a.push(nextRow);

      // fire debounced server save
      saveServer(a);
      return a;
    });
  }

  // quick-add headwords -> creates blocks in Entry (for sequences that start with row 1)
  function quickAddWordsForRow(bKey: string) {
    const s = prompt("Enter headword(s) to create Entry blocks (comma-separated or newline)");
    if (s === null) return;
    const words = parseWords(s);
    if (!words.length) {
      alert("No words entered.");
      return;
    }

    const sequences: string[][] = readJSON(LS.sequences, []);
    const starting = (sequences || []).filter((p) => Array.isArray(p) && p[0] === bKey);
    if (!starting.length) {
      alert("No sequences start with this row. Save sequences first.");
      return;
    }

    const existing = readJSON(LS.entry, {} as Record<string, any[]>);
    const m = catalogMap(readJSON(LS.catalog, []));
    starting.forEach((path) => {
      const seqKey = path.join("|");
      const blocks = Array.isArray(existing[seqKey]) ? existing[seqKey].slice() : [];
      words.forEach((w) => {
        const nb = blocks.length ? blocks[blocks.length - 1].block + 1 : 1;
        blocks.push({
          block: nb,
          rows: path.map((bk, i) => ({
            tokenIndex: i,
            token: m.get(bk)?.bVal || bk,
            block: nb,
            dec: 1,
            output: i === 0 ? w : "enter output value",
          })),
        });
      });
      existing[seqKey] = blocks;
    });
    writeJSON(LS.entry, existing);
    alert(`Added ${words.length} headword block(s) to ${starting.length} sequence(s). Open the Entry tab to see them.`);
  }

  const pageRows = useMemo(() => {
    const out: number[] = [];
    for (let i = start; i < start + perPage; i++) out.push(i);
    return out;
  }, [start, perPage]);

  // Manual save button (optional; in case user wants to force save)
  const manualSave = async () => {
    const r = await api("/stage1/bc:save", {
      method: "POST",
      body: JSON.stringify({ reason: slug, items: catalog }),
    });
    if (r?.ok) alert("B/C saved to server.");
    else alert("Save failed: " + (r?.error || "unknown error"));
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <b>B/C Numbered Editor</b>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={enforceNoMatch}
            onChange={(e) => setEnforceNoMatch(e.target.checked)}
          />{" "}
          Enforce B≠C
        </label>
        <label style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => setCaseSensitive(e.target.checked)}
          />{" "}
          Case sensitive
        </label>
        <Button onClick={manualSave} title="Force-save to server">
          Save
        </Button>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div>Start index</div>
        <Input
          value={start}
          onChange={(e) => setStart(Math.max(1, Number(e.target.value) || 1))}
          style={{ width: 80 }}
        />
        <div>Rows per page</div>
        <select
          value={perPage}
          onChange={(e) => setPerPage(Number(e.target.value))}
          style={{ padding: 6, border: "1px solid #d1d5db", borderRadius: 8 }}
        >
          {[50, 100, 200, 500].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb", width: 60 }}>
                #
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb", width: 180 }}>
                column B- label
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                value-1
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb", width: 200 }}>
                column C- label
              </th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>
                value-2
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((i) => {
              const bKey = `column B-${i}`;
              const cKey = `column C-${i}`;
              const rec = byBKey.get(bKey) || { bKey, cKey, bVal: "", cVal: "" };
              return (
                <tr key={i}>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>{i}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", color: "#111827" }}>{bKey}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Input
                        value={rec.bVal}
                        onChange={(e) => updateVal(bKey, "bVal", e.target.value)}
                        placeholder="add value-1"
                      />
                      {i === 1 && (
                        <Button title="Quick add headword(s) for sequences starting here" onClick={() => quickAddWordsForRow(bKey)}>
                          + words
                        </Button>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9", color: "#111827" }}>{cKey}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #f1f5f9" }}>
                    <Input
                      value={rec.cVal}
                      onChange={(e) => updateVal(bKey, "cVal", e.target.value)}
                      placeholder="add value-2"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize: 12, color: "#6b7280" }}>
        Rules: values across BOTH columns must be globally unique (no duplicates). If enabled, value-1 and value-2 cannot match for a row.
      </div>
    </div>
  );
}
