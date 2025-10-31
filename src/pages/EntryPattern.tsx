import React, { useEffect, useState } from "react";
import { Button, Input, S, Tag } from "@shared/ui";
import { LS_FOR, readJSON, writeJSON } from "@shared/storage";
import type { Block, BlockRow } from "@shared/types";
import { PLACEHOLDER } from "@shared/constants";

export default function EntryPattern({ slug }: { slug: string }) {
  const LS = LS_FOR(slug);
  const [blocks, setBlocks] = useState<Block[]>(() => readJSON(LS.entry, []));

  useEffect(() => writeJSON(LS.entry, blocks), [blocks, LS.entry]);

  const addBlock = () => {
    const block = (blocks[blocks.length - 1]?.block ?? 0) + 1;
    setBlocks([...blocks, { block, rows: [] }]);
  };

  const addRow = (b: Block) => {
    const tokenIndex = (b.rows[b.rows.length - 1]?.tokenIndex ?? 0) + 1;
    const row: BlockRow = {
      tokenIndex,
      block: b.block,
      dec: 1,
      output: "",
      dbSkipRow: false, // ✅ fixed (was "False")
    };
    setBlocks((prev) =>
      prev.map((x) =>
        x.block === b.block ? { ...x, rows: [...x.rows, row] } : x
      )
    );
  };

  const setRow = (b: Block, i: number, patch: Partial<BlockRow>) => {
    setBlocks((prev) =>
      prev.map((x) => {
        if (x.block !== b.block) return x;
        const rows = x.rows.slice();
        rows[i] = { ...rows[i], ...patch };
        return { ...x, rows };
      })
    );
  };

  const delBlock = (b: Block) =>
    setBlocks((prev) => prev.filter((x) => x.block !== b.block));

  return (
    <div>
      <div style={S.toolbar}>
        <div style={S.h2}>
          Entry — Pattern (blocks) — <Tag>{slug}</Tag>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Button onClick={addBlock}>+ Block</Button>
        </div>
      </div>

      {blocks.length === 0 && (
        <div style={S.small}>No blocks yet. Click “+ Block”.</div>
      )}

      {blocks.map((b) => (
        <div
          key={b.block}
          style={{
            border: "1px solid #E5E7EB",
            borderRadius: 10,
            padding: 12,
            marginBottom: 10,
            background: "#fff",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div style={S.h2}>Block {b.block}</div>
            <Button onClick={() => delBlock(b)}>🗑️</Button>
            <div style={{ marginLeft: "auto" }}>
              <Button onClick={() => addRow(b)}>+ Row</Button>
            </div>
          </div>

          {b.rows.length === 0 && (
            <div style={S.small}>No rows yet. Click “+ Row”.</div>
          )}

          {b.rows.map((r, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: "80px 80px 1fr 120px",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <Input
                type="number"
                value={r.tokenIndex}
                onChange={(e) =>
                  setRow(b, i, { tokenIndex: parseInt(e.target.value || "0", 10) })
                }
              />
              <Input
                type="number"
                value={r.dec}
                onChange={(e) =>
                  setRow(b, i, { dec: parseInt(e.target.value || "1", 10) })
                }
              />
              <Input
                placeholder={PLACEHOLDER}
                value={r.output}
                onChange={(e) => setRow(b, i, { output: e.target.value })}
              />
              <label
                style={{ ...S.small, display: "flex", alignItems: "center", gap: 6 }}
              >
                <input
                  type="checkbox"
                  checked={r.dbSkipRow}
                  onChange={(e) => setRow(b, i, { dbSkipRow: e.target.checked })}
                />{" "}
                🚫🗄️ skip
              </label>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
