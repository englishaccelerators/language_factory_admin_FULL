import React, { useMemo, useState } from "react";
import { Button, Input, S, Tag } from "@shared/ui";
import { REASONS_LS, writeJSON } from "@shared/storage";
import type { Reason } from "@shared/types";

/** === NEW ===
 * Backend base URL. If your API is on the same origin, leave empty "".
 * If it's somewhere else, set VITE_STAGE1_API in your .env (e.g. http://localhost:8787).
 */
const API_BASE =
  (import.meta as any)?.env?.VITE_STAGE1_API?.trim?.() ?? "";

/** Simple fetch wrapper that hits your Stage-1 API */
async function api(path: string, init?: RequestInit) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  return res.json();
}

export default function ReasonIndex({
  reasons,
  setReasons,
  openReason,
}: {
  reasons: Reason[];
  setReasons: (x: Reason[]) => void;
  openReason: (r: Reason) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const perPage = 20;

  const tree = useMemo(() => {
    const kids = new Map<string, Reason[]>();
    reasons.forEach((r) => {
      const p = (r as any).parent || "__root__";
      if (!kids.has(p)) kids.set(p, []);
      kids.get(p)!.push(r);
    });
    const order: (Reason & { depth?: number })[] = [];
    const walk = (pid: string, d: number) => {
      (kids.get(pid) || [])
        .sort((a, b) => a.title.localeCompare(b.title))
        .forEach((r) => {
          order.push({ ...r, depth: d });
          // @ts-ignore
          walk((r as any).id, d + 1);
        });
    };
    walk("__root__", 0);
    return order;
  }, [reasons]);

  const filtered = useMemo(
    () =>
      !q.trim()
        ? tree
        : tree.filter((r) =>
            `${r.title} ${r.slug}`.toLowerCase().includes(q.toLowerCase())
          ),
    [q, tree]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  /** === UPDATED ===
   * Add New → now calls backend to create the per-Reason Postgres table.
   */
  const addNew = async () => {
    const title = prompt("Reason title:");
    if (!title) return;

    const suggested = title
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const slug = prompt("Slug (a-z,0-9,_,-):", suggested);
    if (!slug) return;

    const language = prompt("Language code (default: en):", "en") || "en";

    // 1) Tell the backend to create this Reason (this triggers Postgres table creation)
    try {
      const res = await api("/stage1/reason:create", {
        method: "POST",
        body: JSON.stringify({ slug, language, actor: "owner" }),
      });
      if (!res?.ok) {
        alert("Create failed: " + (res?.error || "unknown error"));
        return;
      }
    } catch (e: any) {
      alert("Create failed: " + (e?.message || e));
      return;
    }

    // 2) If backend succeeded, add to local list so UI shows it immediately
    const id = `r-${crypto.randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();
    const next = [
      { id, title, slug, author: "owner", date: now, parent: null } as any,
      ...reasons,
    ];
    setReasons(next);
    writeJSON(REASONS_LS, next);
    alert(`Reason "${title}" created.\nPostgreSQL table: text_reason_${slug}`);
  };

  const deleteOne = (r: Reason) => {
    if (!confirm(`Delete “${r.title}”?`)) return;
    const next = reasons.filter((x) => x.id !== (r as any).id);
    setReasons(next);
    writeJSON(REASONS_LS, next);
  };

  return (
    <div>
      <div style={S.toolbar}>
        <div style={S.h1}>Pages</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <Input
            placeholder="Search Pages"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
          <Button onClick={addNew}>+ Add New</Button>
        </div>
      </div>

      <table style={{ ...S.table }}>
        <thead style={{ background: "#F3F4F6" }}>
          <tr>
            <th style={{ textAlign: "left", padding: 8, width: 32 }}> </th>
            <th style={{ textAlign: "left", padding: 8 }}>Title</th>
            <th style={{ textAlign: "left", padding: 8 }}>Author</th>
            <th style={{ textAlign: "left", padding: 8 }}>Date</th>
            <th style={{ width: 80 }} />
          </tr>
        </thead>
        <tbody>
          {pageRows.map((r: any) => (
            <tr key={r.id} style={{ borderTop: "1px solid #E5E7EB" }}>
              <td style={{ padding: 8 }}>
                <input
                  type="checkbox"
                  checked={!!selected[r.id]}
                  onChange={(e) =>
                    setSelected({ ...selected, [r.id]: e.target.checked })
                  }
                />
              </td>
              <td style={{ padding: 8 }}>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    openReason(r);
                  }}
                  style={{
                    color: "#111827",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  {r.depth ? "— ".repeat(r.depth) : ""}
                  {r.title}
                </a>
                <div>
                  <Tag>/{r.slug}</Tag>
                </div>
              </td>
              <td style={{ padding: 8 }}>
                <a href="mailto:owner@example.com">owner</a>
              </td>
              <td style={{ padding: 8 }}>
                {new Date(r.date).toLocaleString()}
              </td>
              <td style={{ padding: 8 }}>
                <Button
                  style={{ fontSize: 12, padding: "4px 8px" }}
                  onClick={() => deleteOne(r)}
                >
                  🗑️ Delete
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>
        Stage-1 admin · Reason → B/C → Sequences → Entry → Entry-Face
        · Data is isolated by Reason.
      </div>
    </div>
  );
}
