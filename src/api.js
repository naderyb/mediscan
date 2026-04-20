/**
 * MediScan - API Client
 * ─────────────────────
 * Place this file at:  mediscan/frontend/src/api.js
 *
 * This replaces all localStorage usage in MediScan.jsx.
 * The API base URL is read from the Vite env variable VITE_API_URL.
 * Create frontend/.env with:
 *   VITE_API_URL=http://localhost:3001
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

// ─── Load all patients ────────────────────────────────────────────────────────
// Replaces: JSON.parse(localStorage.getItem("mediscan_patients")) || DEMO_PATIENTS
export async function loadPatients() {
  const res = await fetch(`${BASE}/api/patients`);
  if (!res.ok) throw new Error("Erreur chargement patients");
  return res.json();
}

// ─── Create a new patient ─────────────────────────────────────────────────────
// Replaces: setPatients([...patients, newPatient])
// Returns the full patient object including { qr: { qr_image_url } }
export async function addPatient(form) {
  const res = await fetch(`${BASE}/api/patients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erreur création patient");
  }
  return res.json();
}

// ─── Update a patient ─────────────────────────────────────────────────────────
export async function updatePatient(id, form) {
  const res = await fetch(`${BASE}/api/patients/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Erreur mise à jour");
  }
  return res.json();
}

// ─── Delete a patient ─────────────────────────────────────────────────────────
// Replaces: setPatients(patients.filter(p => p.id !== id))
export async function deletePatient(id) {
  const res = await fetch(`${BASE}/api/patients/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Erreur suppression patient");
  return res.json();
}

// ─── Fetch single patient by UUID or display_id ───────────────────────────────
export async function getPatient(id) {
  const res = await fetch(`${BASE}/api/patients/${id}`);
  if (!res.ok) return null;
  return res.json();
}

// ─── QR Scan → fetch patient dossier ─────────────────────────────────────────
// Replaces: patients.find(p => p.id === scannedId)
// Call this from handleScanResult(scannedId) in ScannerSection
// Returns full dossier { ...patient, medical, qr } or null if not found
export async function scanPatient(displayId) {
  const res = await fetch(`${BASE}/api/scan/${displayId}`);
  if (!res.ok) return null;
  return res.json();
}

// ─── Regenerate QR (lost bracelet) ───────────────────────────────────────────
// Returns new { qr_image_url, payload, ... }
export async function regenerateQR(patientUuid) {
  const res = await fetch(`${BASE}/api/patients/${patientUuid}/qr`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Erreur génération QR");
  return res.json();
}

// ─── Scan logs for a patient ──────────────────────────────────────────────────
export async function getScanLogs(patientUuid) {
  const res = await fetch(`${BASE}/api/scan-logs/${patientUuid}`);
  if (!res.ok) return [];
  return res.json();
}
