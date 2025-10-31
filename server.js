// server.js
import express from "express";
import fs from "fs";
import cors from "cors";
import bodyParser from "body-parser";

const PORT = process.env.PORT || 8000;
const DB_FILE = "./stage1-text.json";
const ARCHIVE_FILE = "./stage1-archive.json";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Simple local JSON "DB"
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, "utf8") || "[]");
const writeDB = (rows) => fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2));

const readArchive = () => JSON.parse(fs.readFileSync(ARCHIVE_FILE, "utf8") || "[]");
const writeArchive = (rows) => fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(rows, null, 2));

app.post("/stage1/text:upsert", (req, res) => {
  const { rows, language, tenant, reason } = req.body;
  if (!Array.isArray(rows)) return res.status(400).send("Rows missing");

  const db = readDB();
  const archive = readArchive();

  let saved = 0;

  rows.forEach((row) => {
    const { identifiercode, output_value } = row;
    const existing = db.find((r) => r.identifiercode === identifiercode);

    if (existing) {
      // Archive old if output_value changed
      if (existing.output_value !== output_value) {
        archive.push({
          ...existing,
          archived_at: new Date().toISOString(),
          archived_by_reason: reason,
        });
      }
    }

    // Remove existing from DB
    const filtered = db.filter((r) => r.identifiercode !== identifiercode);

    // Add new
    filtered.push({
      ...row,
      language,
      tenant,
      reason,
      updated_at: new Date().toISOString(),
    });

    writeDB(filtered);
    writeArchive(archive);
    saved++;
  });

  res.json({ ok: true, saved });
});

app.listen(PORT, () => {
  console.log(`🧠 Language Factory API running at http://localhost:${PORT}`);
});
