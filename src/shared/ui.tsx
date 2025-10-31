import React from "react";

export const S = {
  page: { padding: 16, fontFamily: "system-ui, -apple-system, Segoe UI, Arial, sans-serif", color: "#111" },
  h1: { fontSize: 18, fontWeight: 700 as const },
  h2: { fontSize: 16, fontWeight: 700 as const },
  toolbar: { display: "flex", gap: 8, alignItems: "center", margin: "10px 0 12px" },
  btn: { padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", background: "#fff", cursor: "pointer", fontSize: 13 },
  input: { padding: "6px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13 },
  small: { fontSize: 12, color: "#6B7280" },
  table: { width: "100%", borderCollapse: "collapse" as const, background:"#fff", border:"1px solid #E5E7EB", borderRadius:10, overflow:"hidden" },
  th: { textAlign: "left" as const, fontSize: 12, color: "#374151", background: "#F9FAFB", padding: "10px 12px", borderBottom: "1px solid #E5E7EB" },
  td: { fontSize: 13, padding: "10px 12px", borderBottom: "1px solid #F3F4F6", verticalAlign: "top" as const },
} as const;

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (p) =>
  <button style={{ ...S.btn, ...(p.style || {}) }} {...p} />;

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (p) =>
  <input style={{ ...S.input, ...(p.style || {}) }} {...p} />;

export const Tag: React.FC<React.PropsWithChildren> = ({ children }) =>
  <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:999, background:"#F3F4F6", fontSize:12, border:"1px solid #E5E7EB" }}>
    {children}
  </span>;

export const Chip: React.FC<React.PropsWithChildren> = ({ children }) =>
  <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"2px 8px",
    borderRadius:999, border:"1px solid #E5E7EB", background:"#F8FAFC", fontSize:12 }}>
    {children}
  </span>;
