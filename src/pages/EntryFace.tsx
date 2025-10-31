import React, { useEffect, useMemo, useState } from "react";
import { Button, Input, Chip, S } from "@shared/ui";
import { LS_FOR, readJSON, writeJSON, downloadBlob } from "@shared/storage";
import { PLACEHOLDER } from "@shared/constants";
import {
  catalogMap, bToken, humanLabel,
  isFilledOutput, exportValueFor, buildExcelHtml
} from "@shared/utils";
import { apiJson, API, queuePush } from "@shared/api";

type BlockRow = {
  tokenIndex: number;
  token: string;
  block: number;
  dec: number | undefined;
  output: string;
  dbSkipRow?: boolean;
};

type Block = { block: number; rows: BlockRow[] };

const nextDecimal = (rowsForToken: BlockRow[]) =>
  rowsForToken.reduce((m, r) => Math.max(m, (r.dec ?? 1)), 0) + 1;

const headwordOverride = (b: Block) => {
  const t0 = (b?.rows ?? [])
    .filter((r) => r.tokenIndex === 0)
    .sort((a, b) => (a.dec ?? 1) - (b.dec ?? 1));
  const filled = t0.find((r) => isFilledOutput(r.output));
  return filled ? String(filled.output) : null;
};

const makeId = (
  tokens: string[],
  tokenIndex: number,
  block: number,
  dec: number | undefined,
  first: string | null
) => {
  const d = dec ?? 1;
  const parts: string[] = [];
  for (let i = 0; i <= tokenIndex; i++) {
    const label = tokens[i];
    if (i === 0) parts.push(first ?? label);
    else parts.push(`${label}-${label === "E" ? d : block}`);
  }
  return parts.join("-");
};

const collectPairs = (blocks: Block[], tokens: string[]): [string, string][] => {
  const out: [string, string][] = [];
  for (const b of blocks) {
    const first = headwordOverride(b);
    const byTok = new Map<number, (BlockRow & { idx: number })[]>();
    b.rows.forEach((r, idx) => {
      const k = r.tokenIndex;
      (byTok.get(k) ?? byTok.set(k, []).get(k)!).push({ ...r, idx });
    });
    for (const [, rows] of [...byTok.entries()].sort((a, b) => a[0] - b[0])) {
      for (const r of rows.sort((a, b) => (a.dec ?? 1) - (b.dec ?? 1))) {
        if (r.dbSkipRow) continue;
        if (!isFilledOutput(r.output)) continue;
        out.push([
          makeId(tokens, r.tokenIndex, r.block, r.dec ?? 1, first),
          exportValueFor(r.output),
        ]);
      }
    }
  }
  return out;
};

export default function EntryFace({ slug }: { slug: string }) {
  const LS = LS_FOR(slug);
  const [catalog] = useState(() => readJSON(LS.catalog, []));
  const byBKey = useMemo(() => catalogMap(catalog), [catalog]);
  const [sequences] = useState(() => readJSON(LS.sequences, []));
  const [store, setStore] = useState<Record<string, Block[]>>(() => readJSON(LS.entry, {}));
  const [joiner, setJoiner] = useState("; ");
  const [preview, setPreview] = useState<{ seqKey: string | null; rows: [string, string][] }>({ seqKey: null, rows: [] });

  useEffect(() => writeJSON(LS.entry, store), [store, LS.entry]);

  const seqModels = useMemo(() => (sequences || []).map((path) => {
    const tokens = path.map((bk) => bToken(bk, byBKey));
    const title = path.map((bk) => humanLabel(bk, byBKey)).join(" → ");
    const seqKey = path.join("|");
    return { seqKey, title, tokens };
  }), [sequences, byBKey]);

  const composerText = useMemo(() => {
    const parts: string[] = [];
    for (const { seqKey, title } of seqModels) {
      const list = store?.[seqKey] || [];
      for (const b of list) {
        const joined = b.rows.map((r) => r.output).filter(Boolean).join(joiner);
        const prefix = joined ? `${title} — Block ${b.block}: ` : `${title} — Block ${b.block}`;
        parts.push(prefix + (joined || ""));
      }
    }
    return parts.join("\n");
  }, [store, seqModels, joiner]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <b>Preview + Export</b>
        <div style={{ marginTop: 8, marginBottom: 8 }}>
          <Input value={joiner} onChange={(e) => setJoiner(e.target.value)} style={{ width: 120 }} />
          <Button onClick={() => navigator.clipboard.writeText(composerText)}>Copy</Button>
          <Button onClick={() => downloadBlob(`${slug}-preview.md`, composerText, "text/markdown")}>Download</Button>
        </div>
        <pre style={{ whiteSpace: "pre-wrap", background: "#f9fafb", padding: 8, borderRadius: 8 }}>{composerText}</pre>
      </div>

      {seqModels.map(({ seqKey, title, tokens }) => {
        const rows = collectPairs(store?.[seqKey] || [], tokens);
        return (
          <div key={seqKey} style={{ marginBottom: 24 }}>
            <b>{title}</b>
            <Button onClick={() => {
              const header = ["identifiercode", "output value"];
              const csv = [header.join(",")]
                .concat(rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")))
                .join("\n");
              downloadBlob(`${slug}-entry.csv`, csv, "text/csv;charset=utf-8");
            }}>
              Export CSV
            </Button>
          </div>
        );
      })}
    </div>
  );
}
