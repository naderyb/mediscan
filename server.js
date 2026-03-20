/* eslint-env node */

import "dotenv/config";
import express from "express";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { toFile } from "qrcode";
import cors from "cors";
import { join, dirname } from "path";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Required: give Neon's driver a WebSocket constructor for Node.js
neonConfig.webSocketConstructor = ws;

const app = express();
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://medicalscan.vercel.app"
  ]
}));
app.use(express.json());

// ── Static QR image serving ───────────────────────────────────────────────────
const QR_DIR = join(__dirname, "storage", "qr");
mkdirSync(QR_DIR, { recursive: true });
app.use("/storage", express.static(join(__dirname, "storage")));

// ── Neon DB Pool ──────────────────────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

pool
  .connect()
  .then((client) => {
    console.log("✅  Connected to Neon PostgreSQL");
    client.release();
  })
  .catch((e) => console.error("❌  Neon connection failed:", e.message));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function generateQR(client, patientId, displayId) {
  const filename = `${displayId}.png`;
  const filePath = join(QR_DIR, filename);
  const imageUrl = `/storage/qr/${filename}`;

  await toFile(filePath, displayId, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#000000", light: "#ffffff" },
  });

  await client.query(
    "UPDATE qr_codes SET is_active = FALSE WHERE patient_id = $1",
    [patientId],
  );

  const { rows } = await client.query(
    `INSERT INTO qr_codes (patient_id, payload, qr_image_url, is_active)
     VALUES ($1, $2, $3, TRUE) RETURNING *`,
    [patientId, displayId, imageUrl],
  );
  return rows[0];
}

async function fetchFullPatient(client, identifier, byDisplay = false) {
  const col = byDisplay ? "display_id" : "id";
  const { rows: p } = await client.query(
    `SELECT * FROM patients WHERE ${col} = $1`,
    [identifier],
  );
  if (!p.length) return null;

  const [med, qr] = await Promise.all([
    client.query("SELECT * FROM medical_records WHERE patient_id = $1", [
      p[0].id,
    ]),
    client.query(
      "SELECT * FROM qr_codes WHERE patient_id = $1 AND is_active = TRUE LIMIT 1",
      [p[0].id],
    ),
  ]);

  return { ...p[0], medical: med.rows[0] || null, qr: qr.rows[0] || null };
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/api/patients", async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`
      SELECT p.*, q.qr_image_url, q.payload AS qr_payload
      FROM patients p
      LEFT JOIN qr_codes q ON q.patient_id = p.id AND q.is_active = TRUE
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error("GET /api/patients:", e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.get("/api/patients/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const byDisplay = req.params.id.startsWith("H-");
    const patient = await fetchFullPatient(client, req.params.id, byDisplay);
    if (!patient) return res.status(404).json({ error: "Patient introuvable" });

    await client.query(
      `INSERT INTO scan_logs (patient_id, qr_code_id, scanned_by, device_info)
       VALUES ($1,$2,$3,$4)`,
      [
        patient.id,
        patient.qr?.id || null,
        req.headers["x-staff"] || "system",
        req.headers["user-agent"] || null,
      ],
    );

    res.json(patient);
  } catch (e) {
    console.error("GET /api/patients/:id:", e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post("/api/patients", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      prenom,
      nom,
      dob,
      sexe,
      sang,
      admission,
      medecin,
      service,
      tel,
      adresse,
      chronique,
      allergies,
      traitements,
      notes,
    } = req.body;

    if (!prenom?.trim() || !nom?.trim())
      return res.status(400).json({ error: "Prénom et nom obligatoires" });

    const { rows: pRows } = await client.query(
      `INSERT INTO patients
         (prenom, nom, dob, sexe, sang, admission, medecin, service, tel, adresse)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        prenom,
        nom,
        dob || null,
        sexe || null,
        sang || null,
        admission || null,
        medecin || null,
        service || null,
        tel || null,
        adresse || null,
      ],
    );
    const patient = pRows[0];

    await client.query(
      `INSERT INTO medical_records
         (patient_id, chronique, allergies, traitements, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        patient.id,
        chronique || null,
        allergies || null,
        traitements || null,
        notes || null,
        medecin || null,
      ],
    );

    const qr = await generateQR(client, patient.id, patient.display_id);

    await client.query("COMMIT");
    res.status(201).json({ ...patient, qr });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("POST /api/patients:", e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.put("/api/patients/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const {
      prenom,
      nom,
      dob,
      sexe,
      sang,
      admission,
      medecin,
      service,
      tel,
      adresse,
      chronique,
      allergies,
      traitements,
      notes,
    } = req.body;

    await client.query(
      `UPDATE patients
       SET prenom=$1, nom=$2, dob=$3, sexe=$4, sang=$5,
           admission=$6, medecin=$7, service=$8, tel=$9, adresse=$10
       WHERE id=$11`,
      [
        prenom,
        nom,
        dob || null,
        sexe,
        sang,
        admission || null,
        medecin || null,
        service || null,
        tel || null,
        adresse || null,
        req.params.id,
      ],
    );

    await client.query(
      `INSERT INTO medical_records (patient_id, chronique, allergies, traitements, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (patient_id) DO UPDATE
         SET chronique=$2, allergies=$3, traitements=$4, notes=$5,
             created_by=$6, updated_at=NOW()`,
      [
        req.params.id,
        chronique || null,
        allergies || null,
        traitements || null,
        notes || null,
        medecin || null,
      ],
    );

    await client.query("COMMIT");
    const updated = await fetchFullPatient(client, req.params.id);
    res.json(updated);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("PUT /api/patients/:id:", e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.delete("/api/patients/:id", async (req, res) => {
  const client = await pool.connect();
  try {
    const { rowCount } = await client.query(
      "DELETE FROM patients WHERE id = $1",
      [req.params.id],
    );
    if (!rowCount)
      return res.status(404).json({ error: "Patient introuvable" });
    res.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/patients/:id:", e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.post("/api/patients/:id/qr", async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT id, display_id FROM patients WHERE id = $1",
      [req.params.id],
    );
    if (!rows.length)
      return res.status(404).json({ error: "Patient introuvable" });
    const qr = await generateQR(client, rows[0].id, rows[0].display_id);
    res.json(qr);
  } catch (e) {
    console.error("POST /api/patients/:id/qr:", e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.get("/api/scan/:displayId", async (req, res) => {
  const client = await pool.connect();
  try {
    const patient = await fetchFullPatient(client, req.params.displayId, true);
    if (!patient)
      return res
        .status(404)
        .json({ error: `Introuvable: ${req.params.displayId}` });

    await client.query(
      `INSERT INTO scan_logs (patient_id, qr_code_id, scanned_by, device_info)
       VALUES ($1,$2,$3,$4)`,
      [
        patient.id,
        patient.qr?.id || null,
        req.headers["x-staff"] || "scanner",
        req.headers["user-agent"] || null,
      ],
    );

    res.json(patient);
  } catch (e) {
    console.error("GET /api/scan/:displayId:", e.message);
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

app.get("/api/scan-logs/:patientId", async (req, res) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT * FROM scan_logs WHERE patient_id=$1 ORDER BY scanned_at DESC",
      [req.params.patientId],
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () =>
  console.log(`🏥  MediScan API → http://localhost:${PORT}`),
);
