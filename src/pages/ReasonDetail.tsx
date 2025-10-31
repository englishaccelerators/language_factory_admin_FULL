// src/pages/ReasonDetail.tsx
import React, { useState } from "react";
import { Button, S } from "@shared/ui";
import BCEditor from "@pages/BCEditor";
import Sequences from "@pages/Sequences";
import Entry from "@pages/Entry";
import EntryFace from "@pages/EntryFace";
import type { Reason } from "@shared/types";

/** optional: quick Publish button to refresh the materialized view */
const API_BASE =
  (import.meta as any)?.env?.VITE_STAGE1_API?.trim?.() ?? "";

async function publishReason(slug: string) {
  try {
    const res = await fetch(API_BASE + "/stage1/reason:publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || "Publish failed");
    alert("Published view refreshed!");
  } catch (e: any) {
    alert(e?.message || "Publish failed");
  }
}

export default function ReasonDetail({
  reason,
  onBack,
}: {
  reason: Reason;
  onBack: () => void;
}) {
  const [tab, setTab] =
    useState<"bc" | "seq" | "entry" | "entryface">("bc");

  return (
    <div>
      <div style={S.toolbar}>
        <Button onClick={onBack}>‹ All Pages</Button>
        <div style={{ marginLeft: 8, ...S.h1 }}>{reason.title}</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {/* quick publish for this reason */}
          <Button onClick={() => publishReason((reason as any).slug)}>
            Publish
          </Button>

          <Button
            onClick={() => setTab("bc")}
            style={{ background: tab === "bc" ? "#F3F4F6" : "#fff" }}
          >
            B/C
          </Button>
          <Button
            onClick={() => setTab("seq")}
            style={{ background: tab === "seq" ? "#F3F4F6" : "#fff" }}
          >
            Sequences
          </Button>
          <Button
            onClick={() => setTab("entry")}
            style={{ background: tab === "entry" ? "#F3F4F6" : "#fff" }}
          >
            Entry (IDs)
          </Button>
          <Button
            onClick={() => setTab("entryface")}
            style={{ background: tab === "entryface" ? "#F3F4F6" : "#fff" }}
          >
            Entry-Face (Text)
          </Button>
        </div>
      </div>

      {tab === "bc" && <BCEditor slug={(reason as any).slug} />}
      {tab === "seq" && <Sequences slug={(reason as any).slug} />}
      {tab === "entry" && <Entry slug={(reason as any).slug} />}
      {tab === "entryface" && <EntryFace slug={(reason as any).slug} />}

      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 12 }}>
        Stage-1 admin · Reason → B/C → Sequences → Entry (IDs) → Entry-Face (Text)
        · Data is isolated by Reason.
      </div>
    </div>
  );
}
