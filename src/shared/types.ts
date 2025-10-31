export type Reason = { id: string; title: string; slug: string; author: string; date: string; parent: string | null; depth?: number };
export type CatalogRow = { bKey: string; cKey: string; bVal: string; cVal: string };
export type BlockRow = { tokenIndex: number; block: number; dec: number; output: string; dbSkipRow: boolean };
export type Block    = { block: number; rows: BlockRow[] };
export type SeqModel = { seqKey: string; title: string; tokens: string[] };
