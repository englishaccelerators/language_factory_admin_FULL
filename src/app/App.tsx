import React, { useEffect, useState } from "react";
import { S } from "@shared/ui";
import ReasonIndex from "@pages/ReasonIndex";
import ReasonDetail from "@pages/ReasonDetail";
import { readJSON, writeJSON, REASONS_LS, ACTIVE_REASON_LS } from "@shared/storage";
import type { Reason } from "@shared/types";

export default function App() {
  const seed: Reason[] = [
    { id:"r-dictionary", title:"dictionary", slug:"dictionary", author:"owner", date:new Date().toISOString(), parent:null },
  ];

  const [reasons, setReasons] = useState<Reason[]>(() => readJSON(REASONS_LS, seed));
  const [activeId, setActiveId] = useState<string | null>(() => readJSON(ACTIVE_REASON_LS, null));

  useEffect(() => writeJSON(REASONS_LS, reasons), [reasons]);
  useEffect(() => writeJSON(ACTIVE_REASON_LS, activeId), [activeId]);

  const active = reasons.find(r => r.id === activeId) || null;

  return (
    <div style={S.page}>
      {!active && (
        <ReasonIndex
          reasons={reasons}
          setReasons={setReasons}
          openReason={(r) => setActiveId(r.id)}
        />
      )}
      {active && <ReasonDetail reason={active} onBack={() => setActiveId(null)} />}
      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 12 }}>
        Stage-1 admin · Reason → B/C → Sequences → Entry → Entry-Face · Data is isolated by Reason.
      </div>
    </div>
  );
}
