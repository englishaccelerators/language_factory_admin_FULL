
// src/pages/Sequences.tsx — Full version with edit, reorder, export, and import
import React, { useEffect, useMemo, useState } from "react";
import { Button, Input, Chip } from "@shared/ui";
import { LS_FOR, readJSON, writeJSON } from "@shared/storage";
import { catalogMap, pathsEqual, bToken } from "@shared/utils";

export default function Sequences({ slug }: { slug: string }) {
  const LS = LS_FOR(slug);
  const [catalog, setCatalog] = useState<any[]>(() => readJSON(LS.catalog, []));
  const [sequences, setSequences] = useState<string[][]>(() => readJSON(LS.sequences, []));
  const [q, setQ] = useState("");
  const [working, setWorking] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => writeJSON(LS.sequences, sequences), [sequences, LS.sequences]);
  useEffect(() => {
    const onS = (e: StorageEvent) => {
      if (e.key === LS.catalog) setCatalog(readJSON(LS.catalog, []));
    };
    window.addEventListener("storage", onS);
    return () => window.removeEventListener("storage", onS);
  }, [LS.catalog]);

  const byBKey = useMemo(() => catalogMap(catalog), [catalog]);
  const palette = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalog;
    return (catalog || []).filter((r: any) => [r.bKey, r.bVal, r.cVal].some((v: string) => String(v || "").toLowerCase().includes(s)));
  }, [catalog, q]);

  const hasDup = useMemo(() => new Set(working).size !== working.length, [working]);
  const commit = (next: string[][]) => {
    setSequences(next);
    writeJSON(LS.sequences, next);
  };

  const addStep = (bKey: string) => setWorking(w => w.includes(bKey) ? w : [...w, bKey]);
  const move = (i: number, d: number) => setWorking(w => {
    const j = i + d;
    if (j < 0 || j >= w.length) return w;
    const a = w.slice();
    [a[i], a[j]] = [a[j], a[i]];
    return a;
  });
  const remove = (i: number) => setWorking(w => w.filter((_x, idx) => idx !== i));
  const clear = () => {
    setEditingIndex(null);
    setWorking([]);
  };

  const save = () => {
    if (!working.length) return;
    if (hasDup) {
      alert("Sequence has duplicate steps.");
      return;
    }
    if (editingIndex !== null) {
      const next = sequences.map((seq, i) => i === editingIndex ? working.slice() : seq);
      commit(next);
    } else {
      if (sequences.some(p => pathsEqual(p, working))) {
        alert("This exact sequence already exists.");
        return;
      }
      commit([working.slice(), ...sequences]);
    }
    clear();
  };

  const del = (idx: number) => {
    if (window.confirm("Delete this sequence?")) {
      commit(sequences.filter((_x, i) => i !== idx));
    }
  };

  const edit = (idx: number) => {
    setWorking(sequences[idx]);
    setEditingIndex(idx);
  };

  const exportCSV = () => {
    const rows = ["path"];
    sequences.forEach(p => rows.push(JSON.stringify(p.join("-"))));
    const csv = rows.join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `${slug}-sequences.csv`;
    a.click();
  };

  const importCSV = () => {
    const txt = prompt("Paste CSV with header: path");
    if (!txt) return;
    const lines = txt.split(/\r?\n/).filter(Boolean);
    const first = (lines[0] || "").split(",")[0].replace(/"/g, "").trim();
    const arr = (first === "path" ? lines.slice(1) : lines)
      .map(l => { try { return JSON.parse(l); } catch { return l; } })
      .map((s: string) => String(s).split("-").map(x => x.trim()).filter(Boolean))
      .filter(p => p.length);
    const next = sequences.slice();
    arr.forEach(p => { if (!next.some(q => pathsEqual(q, p))) next.push(p); });
    commit(next);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <b>Palette (from Catalog)</b>
          <Input placeholder="Search bKey / value-1 / value-2…" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 280 }} />
          <Chip>{catalog.length} items</Chip>
        </div>
        <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
          {palette.map((r: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 0" }}>
              <span title={(r.cVal || r.bVal || r.bKey)}>
                {r.cVal || r.bVal || r.bKey}
                {r.cVal ? <span style={{ color: "#6b7280", marginLeft: 6 }}>({r.bKey})</span> : null}
              </span>
              <Button onClick={() => addStep(r.bKey)}>+ add</Button>
            </div>
          ))}
          {!palette.length && <i style={{ color: "#6b7280" }}>No matches.</i>}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <b>{editingIndex !== null ? `Edit sequence #${editingIndex + 1}` : "Build new sequence"}</b>
          <Button onClick={save} disabled={!working.length || hasDup}>{editingIndex !== null ? "Update" : "Save"}</Button>
          <Button onClick={clear} disabled={!working.length}>Clear</Button>
          {hasDup && <span style={{ color: "#b91c1c" }}>Remove duplicates first.</span>}
        </div>
        <div style={{ minHeight: 60, border: "1px dashed #cbd5e1", borderRadius: 8, padding: 8 }}>
          {working.length ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {working.map((bk, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#f8fafc" }}>
                  <span>{bToken(bk, byBKey)}</span>
                  <button onClick={() => move(i, -1)} title="Up" style={{ border: "none", background: "transparent", cursor: "pointer" }}>↑</button>
                  <button onClick={() => move(i, +1)} title="Down" style={{ border: "none", background: "transparent", cursor: "pointer" }}>↓</button>
                  <button onClick={() => remove(i)} title="Remove" style={{ border: "none", background: "transparent", cursor: "pointer" }}>✕</button>
                </span>
              ))}
            </div>
          ) : <i style={{ color: "#6b7280" }}>Click items in the palette to add steps…</i>}
        </div>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <b>Saved sequences ({sequences.length})</b>
          <Button onClick={importCSV}>Import CSV</Button>
          <Button onClick={exportCSV} disabled={!sequences.length}>Export CSV</Button>
        </div>
        <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, marginTop: 8 }}>
          {sequences.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 0", gap: 8 }}>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {p.map((bk, j) => <span key={`${bk}-${j}`}>{bToken(bk, byBKey)}{j < p.length - 1 ? " → " : ""}</span>)}
              </span>
              <span style={{ display: "flex", gap: 4 }}>
                <Button onClick={() => edit(i)}>Edit</Button>
                <Button onClick={() => del(i)}>Del</Button>
              </span>
            </div>
          ))}
          {!sequences.length && <i style={{ color: "#6b7280" }}>No sequences yet. Build above, then Save.</i>}
        </div>
      </div>
    </div>
  );
}
