// src/pages/Entry.tsx — RULES ONLY (IDs + include/exclude)
// No text editing, no CSV/XLS, no add/duplicate/delete, no +dec.
// Read-only Preview uses text already entered on Entry-Face.

import React, { useEffect, useMemo, useState } from "react";
import { Button, S } from "@shared/ui";
import { LS_FOR, readJSON, writeJSON } from "@shared/storage";
import { catalogMap, bToken, humanLabel, isFilledOutput } from "@shared/utils";

type BlockRow = { tokenIndex:number; token:string; block:number; dec:number; output:string; dbSkipRow?:boolean };
type Block    = { block:number; rows: BlockRow[] };

// ✅ Use filled headword EVEN IF it's excluded, so IDs keep the human headword prefix.
// (The excluded row itself will still not export — that logic stays in preview/export.)
const headwordOverride = (b: Block) => {
  const t0 = (b?.rows||[])
    .filter(r => r.tokenIndex === 0)
    .sort((a,b) => a.dec - b.dec);
  const filled = t0.find(r => isFilledOutput(r.output));
  return filled ? String(filled.output) : null; // null => fall back to structural label
};

const makeId = (tokens:string[], tokenIndex:number, block:number, dec:number, first:string|null) => {
  const parts:string[] = [];
  for (let i=0;i<=tokenIndex;i++){
    const label = tokens[i];
    if (i===0) parts.push(first ?? label);
    else parts.push(`${label}-${label === "E" ? dec : block}`);
  }
  return parts.join("-");
};

export default function Entry({ slug }:{ slug:string }) {
  const LS = LS_FOR(slug);

  const [catalog]   = useState<any[]>(()=>readJSON(LS.catalog, []));
  const byBKey      = useMemo(()=>catalogMap(catalog), [catalog]);
  const [sequences] = useState<string[][]>(()=>readJSON(LS.sequences, []));
  const [store, setStore] = useState<Record<string, Block[]>>(()=>readJSON(LS.entry, {}));
  const [showPreview, setShowPreview] = useState<string|null>(null); // seqKey or null

  useEffect(()=>writeJSON(LS.entry, store), [store, LS.entry]);

  const seqModels = useMemo(()=> (sequences||[]).map(path=>{
    const tokens = path.map(bk => bToken(bk, byBKey));
    const title  = path.map(bk => humanLabel(bk, byBKey)).join(" → ");
    const seqKey = path.join("|");
    return { seqKey, title, tokens };
  }), [sequences, byBKey]);

  // Toggle include/exclude for a single row
  const toggleRowDb = (seqKey:string, blockNum:number, rowIndex:number) =>
    setStore(prev=>{
      const list = prev?.[seqKey] || [];
      const bi   = list.findIndex(b=>b.block===blockNum); if (bi<0) return prev;
      const block = { ...list[bi], rows:[...list[bi].rows] };
      const row   = block.rows[rowIndex]; if (!row) return prev;
      block.rows[rowIndex] = { ...row, dbSkipRow: !(row.dbSkipRow===true) };
      const next = { ...(prev||{}), [seqKey]: Object.assign([], list, { [bi]: block }) };
      writeJSON(LS.entry, next);
      return next;
    });

  // Read-only preview (skips excluded rows; headword text still influences later IDs)
  const previewRows = (seqKey:string, tokens:string[])=>{
    const rows: [string,string][] = [];
    (store?.[seqKey]||[]).forEach(b=>{
      const first = headwordOverride(b);
      b.rows.forEach(r=>{
        if (r.dbSkipRow===true) return;          // excluded by rule
        if (!isFilledOutput(r.output)) return;   // not filled on Entry-Face
        rows.push([ makeId(tokens, r.tokenIndex, r.block, r.dec, first), String(r.output) ]);
      });
    });
    return rows;
  };

  return (
    <div style={{ display:"grid", gap:12 }}>
      <div style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:12 }}>
        <b>Entry — Rules (IDs)</b>
        <div style={S.small}>
          This page controls <b>only</b> DB include/exclude (🗄️/🚫🗄️).<br/>
          Add blocks/decimals and enter text on <b>Entry-Face</b>.
        </div>
      </div>

      {!seqModels.length && <div style={S.small}>No sequences yet — create them on the Sequences tab.</div>}

      {seqModels.map(({ seqKey, title, tokens })=>{
        const blocks = store?.[seqKey] || [];
        const lines  = previewRows(seqKey, tokens);
        return (
          <div key={seqKey} style={{ border:"1px solid #e5e7eb", borderRadius:12, padding:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <b>{title}</b>
              <div style={{ marginLeft:"auto" }}>
                <Button onClick={()=>setShowPreview(p => p===seqKey ? null : seqKey)}>
                  {showPreview===seqKey ? "Hide preview" : "Preview"}
                </Button>
              </div>
            </div>

            {showPreview===seqKey && (
              <div style={{ background:"#f8fafc", border:"1px solid #e5e7eb", borderRadius:8, padding:8, marginBottom:8 }}>
                <div style={{ fontSize:12, color:"#6b7280", marginBottom:6 }}>
                  {lines.length} row(s) would export for this sequence (based on Entry-Face text).
                </div>
                <div style={{ maxHeight:200, overflow:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead><tr style={{ background:"#eef2f7" }}>
                      <th style={{ textAlign:"left", padding:6, borderBottom:"1px solid #e5e7eb" }}>identifiercode</th>
                      <th style={{ textAlign:"left", padding:6, borderBottom:"1px solid #e5e7eb" }}>output value</th>
                    </tr></thead>
                    <tbody>
                      {lines.map((r,i)=>(
                        <tr key={i}>
                          <td style={{ padding:6, borderBottom:"1px solid #f1f5f9", fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace" }}><code>{r[0]}</code></td>
                          <td style={{ padding:6, borderBottom:"1px solid #f1f5f9" }}>{r[1]}</td>
                        </tr>
                      ))}
                      {!lines.length && (
                        <tr><td colSpan={2} style={{ padding:6, color:"#6b7280" }}>(nothing yet — fill outputs on Entry-Face)</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!blocks.length && <div style={S.small}>No blocks yet (add them on Entry-Face).</div>}

            {blocks.map((block, bi)=>{
              // group rows by tokenIndex
              const grouped = new Map<number, (BlockRow & { idx:number })[]>();
              block.rows.forEach((r, idx)=>{ const k=r.tokenIndex; if(!grouped.has(k)) grouped.set(k,[]); grouped.get(k)!.push({ ...r, idx }); });

              // quick stats
              const stats = (()=> {
                const rows = block.rows || [];
                let included=0, excluded=0;
                rows.forEach(r=> (r.dbSkipRow===true ? excluded++ : included++));
                return { rows: rows.length, included, excluded };
              })();

              return (
                <div key={`block_${bi}`} style={{ marginBottom:12 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                    <b>Block {block.block}</b>
                    <div style={{ display:"flex", gap:8 }}>
                      <span style={{ fontSize:12, color:"#6b7280" }}>Rows: {stats.rows}</span>
                      <span style={{ fontSize:12, color:"#6b7280" }}>Included: {stats.included}</span>
                      <span style={{ fontSize:12, color:"#6b7280" }}>Excluded: {stats.excluded}</span>
                    </div>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"minmax(220px,320px) 120px 1fr 140px", gap:8, fontWeight:600, color:"#6b7280", marginBottom:4 }}>
                    <div>token</div>
                    <div>block.dec</div>
                    <div>identifiercode</div>
                    <div>DB include</div>
                  </div>

                  {[...grouped.keys()].sort((a,z)=>a-z).map(tIdx=>{
                    const list  = grouped.get(tIdx)!.sort((a,z)=>a.dec-z.dec);
                    const first = headwordOverride(block);
                    return list.map(row=>{
                      const id = makeId(seqModels.find(m=>m.seqKey===seqKey)!.tokens, row.tokenIndex, row.block, row.dec, first);
                      const tokenLabel = (row.tokenIndex===0 && first) ? first : row.token;
                      return (
                        <div key={`${row.tokenIndex}-${row.block}-${row.dec}`} style={{ display:"contents" }}>
                          <div style={{ color:"#111827" }}>{tokenLabel}</div>
                          <div>{row.block}.{row.dec}</div>
                          <div><code>{id}</code></div>
                          <div>
                            <Button
                              title={row.dbSkipRow ? "Excluded from DB export" : "Included (if text is filled on Entry-Face)"}
                              onClick={()=>toggleRowDb(seqKey, row.block, row.idx)}
                            >
                              {row.dbSkipRow ? "🚫🗄️" : "🗄️"}
                            </Button>
                          </div>
                        </div>
                      );
                    });
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
