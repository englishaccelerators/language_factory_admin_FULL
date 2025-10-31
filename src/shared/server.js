// src/shared/server.js
// Run with: npm run server
import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import pg from 'pg'
import dotenv from 'dotenv'

dotenv.config()
const { Pool } = pg

// IMPORTANT: set DATABASE_URL in .env to a reachable Postgres host
// Example local: postgres://postgres:YOURPASS@localhost:5432/dictionarydb
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000
})

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/health', (_req, res) => res.json({ ok: true }))

// ---------- REASON (create/list/publish minimal) ----------
const ReasonCreate = z.object({
  slug: z.string().regex(/^[a-z0-9_-]+$/).min(1).max(64),
  language: z.string().default('en'),
  tenant: z.string().nullable().optional(),
  actor: z.string().default('system'),
  meta: z.record(z.any()).optional()
})

// helper: ensure core tables and functions once
async function ensureCore() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    CREATE TABLE IF NOT EXISTS public.reasons (
      id BIGSERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      language TEXT NOT NULL DEFAULT 'en',
      tenant TEXT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_by TEXT NULL,
      updated_by TEXT NULL,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE OR REPLACE FUNCTION public.ensure_reason_table(p_reason TEXT)
    RETURNS VOID AS $$
    DECLARE v_table TEXT := format('text_reason_%s', p_reason); BEGIN
      IF p_reason !~ '^[A-Za-z0-9_-]+$' THEN RAISE EXCEPTION 'Invalid reason slug: %', p_reason; END IF;
      EXECUTE format($F$
        CREATE TABLE IF NOT EXISTS public.%I (
          id BIGSERIAL PRIMARY KEY,
          identifiercode TEXT NOT NULL,
          output_value   TEXT NOT NULL,
          reason_slug    TEXT NOT NULL DEFAULT %L,
          language       TEXT NOT NULL DEFAULT 'en',
          tenant         TEXT NULL,
          status         TEXT NOT NULL DEFAULT 'active',
          version        INTEGER NOT NULL DEFAULT 1,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_by     TEXT NULL,
          meta           JSONB NOT NULL DEFAULT '{}'::jsonb,
          CONSTRAINT %I UNIQUE (identifiercode, language, tenant)
        );
        CREATE INDEX IF NOT EXISTS %I ON public.%I (identifiercode);
        CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant, language);
        CREATE INDEX IF NOT EXISTS %I ON public.%I (status);
        CREATE INDEX IF NOT EXISTS %I ON public.%I USING gin (identifiercode gin_trgm_ops);
      $F$, v_table, p_reason, 'uq_'||p_reason,
           'ix_'||p_reason||'_identifiercode', v_table,
           'ix_'||p_reason||'_tenant_lang', v_table,
           'ix_'||p_reason||'_status', v_table,
           'gin_'||p_reason||'_identifiercode_trgm', v_table);
    END; $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION public.ensure_reason_published_view(p_reason TEXT)
    RETURNS VOID AS $$
    DECLARE v_view TEXT := format('mv_text_reason_%s_published', p_reason);
            v_table TEXT := format('text_reason_%s', p_reason);
    BEGIN
      PERFORM public.ensure_reason_table(p_reason);
      EXECUTE format($F$
        CREATE MATERIALIZED VIEW IF NOT EXISTS public.%I AS
        SELECT identifiercode, output_value, language, tenant
        FROM public.%I WHERE status='active';
        CREATE UNIQUE INDEX IF NOT EXISTS uq_%I ON public.%I (identifiercode, language, tenant);
      $F$, v_view, v_table, v_view, v_view);
    END; $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION public.refresh_reason_published_view(p_reason TEXT)
    RETURNS VOID AS $$ DECLARE v_view TEXT := format('mv_text_reason_%s_published', p_reason);
    BEGIN
      PERFORM public.ensure_reason_published_view(p_reason);
      EXECUTE format('REFRESH MATERIALIZED VIEW CONCURRENTLY public.%I', v_view);
    END; $$ LANGUAGE plpgsql;
  `)
}
ensureCore().catch(console.error)

app.post('/stage1/reason:create', async (req, res) => {
  try {
    const body = ReasonCreate.parse(req.body)
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(
        `INSERT INTO public.reasons (slug, language, tenant, created_by, meta)
         VALUES ($1,$2,$3,$4,COALESCE($5::jsonb,'{}'::jsonb))
         ON CONFLICT (slug) DO UPDATE SET updated_at=now(), updated_by=EXCLUDED.created_by`,
        [body.slug, body.language, body.tenant ?? null, body.actor, JSON.stringify(body.meta || {})]
      )
      await client.query(`SELECT public.ensure_reason_table($1)`, [body.slug])
      await client.query(`SELECT public.ensure_reason_published_view($1)`, [body.slug])
      await client.query('COMMIT')
      res.json({ ok: true, reason: body.slug })
    } finally {
      client.release()
    }
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) })
  }
})

app.get('/stage1/reason:list', async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT id, slug, language, tenant, status, created_at, updated_at, meta
    FROM public.reasons
    WHERE status='active'
    ORDER BY id ASC LIMIT 200`)
  res.json({ ok: true, items: rows, next: null })
})

app.post('/stage1/reason:publish', async (req, res) => {
  try {
    const { slug } = req.body || {}
    if (!/^[a-z0-9_-]+$/.test(slug || '')) throw new Error('invalid slug')
    await pool.query(`SELECT public.refresh_reason_published_view($1)`, [slug])
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) })
  }
})

// ---------- B/C CATALOG (per-reason JSON) ----------
await pool.query(`
  CREATE TABLE IF NOT EXISTS public.bc_catalogs (
    reason_slug TEXT PRIMARY KEY,
    items       JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by  TEXT NULL
  );
`).catch(console.error)

const BCSave = z.object({
  reason: z.string().regex(/^[a-z0-9_-]+$/),
  items: z.array(z.object({
    bKey: z.string(),
    cKey: z.string(),
    bVal: z.string().optional().nullable(),
    cVal: z.string().optional().nullable()
  }))
})

app.get('/stage1/bc:get', async (req, res) => {
  const reason = String(req.query.reason || '')
  if (!/^[a-z0-9_-]+$/.test(reason)) {
    return res.status(400).json({ ok: false, error: 'invalid reason' })
  }
  try {
    const { rows } = await pool.query(
      `SELECT items FROM public.bc_catalogs WHERE reason_slug=$1`,
      [reason]
    )
    res.json({ ok: true, items: rows.length ? rows[0].items : [] })
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) })
  }
})

app.post('/stage1/bc:save', async (req, res) => {
  try {
    const body = BCSave.parse(req.body)
    await pool.query(
      `INSERT INTO public.bc_catalogs (reason_slug, items, updated_at, updated_by)
       VALUES ($1, $2::jsonb, now(), 'admin')
       ON CONFLICT (reason_slug) DO UPDATE
         SET items = EXCLUDED.items, updated_at = now(), updated_by = EXCLUDED.updated_by`,
      [body.reason, JSON.stringify(body.items)]
    )
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message || String(e) })
  }
})

const port = parseInt(process.env.PORT || '8787', 10)
app.listen(port, () => console.log('Stage-1 API listening on :' + port))
