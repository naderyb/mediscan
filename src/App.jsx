/**
 * MediScan — Portail Hospitalier
 * ────────────────────────────────
 * Place this file at:  mediscan/frontend/src/MediScan.jsx
 *
 * Changes from original:
 *   - localStorage removed → replaced with API calls from ./api.js
 *   - QR display uses qr_image_url from server (no more qrcodejs CDN for patient QRs)
 *   - Bracelet print still uses qrcodejs for the inline print QR
 *   - jsQR CDN still used for camera scanning
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  loadPatients,
  addPatient,
  scanPatient,
  deletePatient,
  updatePatient,
} from "./api.js";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const COLORS = [
  "#c8392b",
  "#1a4a8a",
  "#2a7a4a",
  "#7a3a9a",
  "#a05020",
  "#1a6a7a",
];
const SERVICES = [
  "Chirurgie générale",
  "Cardiologie",
  "Urgences",
  "Réanimation",
  "Bloc opératoire",
  "Pédiatrie",
  "Maternité",
  "Oncologie",
  "Orthopédie",
  "Neurologie",
];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

// ─── UTILS ────────────────────────────────────────────────────────────────────
const initials = (p) => (p.prenom[0] + p.nom[0]).toUpperCase();

const ageFromDob = (dob) => {
  if (!dob) return "—";
  return (
    Math.floor((Date.now() - new Date(dob)) / (1000 * 60 * 60 * 24 * 365.25)) +
    " ans"
  );
};

const formatDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const getServiceBadgeClass = (s = "") => {
  const l = s.toLowerCase();
  if (l.includes("bloc") || l.includes("chirurgie")) return "badge-bloc";
  if (l.includes("réanimation") || l.includes("urgences")) return "badge-soins";
  return "badge-standard";
};

// QR for PRINT only (uses qrcodejs CDN — still needed for the bracelet printout)
function usePrintQR(containerRef, text, size = 220) {
  useEffect(() => {
    if (!containerRef.current || !text || !window.QRCode) return;
    containerRef.current.innerHTML = "";
    containerRef.current.style.lineHeight = "0";
    new window.QRCode(containerRef.current, {
      text,
      width: size,
      height: size,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: window.QRCode?.CorrectLevel?.M,
    });

    const qrNode = containerRef.current.querySelector("img,canvas");
    if (qrNode) {
      qrNode.style.width = "100%";
      qrNode.style.height = "100%";
      qrNode.style.display = "block";
      qrNode.style.imageRendering = "pixelated";
    }
  }, [text, size, containerRef]);
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const GLOBAL_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#f0ede8;--surface:#faf8f5;--card:#ffffff;--ink:#1a1612;--ink2:#4a4540;
  --ink3:#8a8480;--accent:#c8392b;--accent2:#e8a020;--green:#2a7a4a;--blue:#1a4a8a;
  --border:#e0dbd4;--shadow:0 2px 20px rgba(26,22,18,.08);--shadow-lg:0 8px 40px rgba(26,22,18,.14);
}
html{scroll-behavior:smooth}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;overflow-x:hidden}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;
  justify-content:space-between;padding:18px 48px;background:rgba(240,237,232,.88);
  backdrop-filter:blur(16px);border-bottom:1px solid var(--border)}
.nav-logo{font-family:'Syne',sans-serif;font-weight:800;font-size:22px;display:flex;
  align-items:center;gap:10px;color:var(--ink);text-decoration:none}
.nav-logo .logo-scan{color:var(--accent)}
.nav-dot{width:10px;height:10px;border-radius:50%;background:var(--accent);display:inline-block;animation:pulse 2s infinite}
.nav-links{display:flex;gap:32px;align-items:center}
.nav-links a{font-size:14px;font-weight:500;color:var(--ink2);text-decoration:none;letter-spacing:.02em;transition:color .2s;cursor:pointer}
.nav-links a:hover{color:var(--accent)}
.nav-cta{background:var(--ink)!important;color:white!important;padding:10px 22px;border-radius:100px;font-size:13px!important;font-weight:600!important;transition:background .2s!important;cursor:pointer;border:none;font-family:'DM Sans',sans-serif}
.nav-cta:hover{background:var(--accent)!important}
.hero{min-height:100vh;display:grid;grid-template-columns:1fr 1fr;align-items:center;padding:120px 48px 80px;gap:80px;position:relative;overflow:hidden}
.hero-bg{position:absolute;inset:0;z-index:0;background:radial-gradient(ellipse 60% 50% at 80% 50%,rgba(200,57,43,.07) 0%,transparent 70%),radial-gradient(ellipse 40% 60% at 20% 80%,rgba(26,74,138,.06) 0%,transparent 70%)}
.hero-grid{position:absolute;inset:0;z-index:0;opacity:.04;background-image:linear-gradient(var(--ink) 1px,transparent 1px),linear-gradient(90deg,var(--ink) 1px,transparent 1px);background-size:48px 48px}
.hero-content{position:relative;z-index:1}
.hero-badge{display:inline-flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--border);border-radius:100px;padding:8px 16px;font-size:12px;font-weight:500;color:var(--ink2);letter-spacing:.05em;text-transform:uppercase;margin-bottom:28px;box-shadow:var(--shadow)}
.badge-dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
.hero h1{font-family:'Syne',sans-serif;color:black;font-weight:800;font-size:clamp(42px,5vw,68px);line-height:1.05;letter-spacing:-.02em;margin-bottom:24px}
.hero h1 em{font-style:normal;color:var(--accent)}
.underline-accent{position:relative;display:inline-block}
.underline-accent::after{content:'';position:absolute;bottom:-4px;left:0;right:0;height:4px;background:var(--accent2);border-radius:2px}
.hero-sub{font-size:17px;line-height:1.7;color:var(--ink2);max-width:460px;margin-bottom:40px;font-weight:300}
.hero-actions{display:flex;gap:16px;flex-wrap:wrap}
.hero-stats{display:flex;gap:32px;margin-top:40px;padding-top:32px;border-top:1px solid var(--border)}
.stat-num{font-family:'Syne',sans-serif;font-weight:800;font-size:28px;color:var(--ink)}
.stat-label{font-size:12px;color:var(--ink3);margin-top:2px}
.hero-visual{position:relative;z-index:1}
.hero-card-stack{position:relative;width:100%;max-width:440px;margin:0 auto}
.hero-card{background:var(--card);border-radius:20px;padding:28px;box-shadow:var(--shadow-lg);border:1px solid var(--border)}
.hc-main{position:relative;z-index:2}
.hc-back{position:absolute;top:-14px;left:14px;right:-14px;border-radius:20px;height:100%;z-index:1;background:var(--bg);border:1px solid var(--border)}
.hc-back2{position:absolute;top:-26px;left:26px;right:-26px;border-radius:20px;height:100%;z-index:0;background:var(--border)}
.hc-header{display:flex;align-items:center;gap:14px;margin-bottom:20px}
.hc-avatar{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,var(--accent) 0%,var(--accent2) 100%);display:flex;align-items:center;justify-content:center;color:white;font-family:'Syne',sans-serif;font-weight:700;font-size:20px}
.hc-name{font-family:'Syne',sans-serif;font-weight:700;font-size:18px}
.hc-dossier{font-size:12px;color:var(--ink3);margin-top:2px}
.hc-badge{margin-left:auto;background:rgba(42,122,74,.1);color:var(--green);border-radius:100px;padding:4px 12px;font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase}
.hc-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
.hc-field label{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);font-weight:600}
.hc-field p{font-size:13px;font-weight:500;margin-top:3px}
.hc-qr-row{display:flex;align-items:center;gap:16px;padding-top:16px;border-top:1px solid var(--border)}
.hc-qr-preview{width:120px;height:120px;border-radius:12px;background:white;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
.hc-qr-preview img{width:100%;height:100%;object-fit:contain}
.hc-qr-text{font-size:12px;color:var(--ink2);line-height:1.5}
.hc-qr-text strong{font-size:13px;color:var(--ink);display:block;margin-bottom:3px}
.btn{display:inline-flex;align-items:center;gap:10px;padding:14px 28px;border-radius:12px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:500;cursor:pointer;border:none;text-decoration:none;transition:all .2s;white-space:nowrap}
.btn-sm{padding:8px 16px;font-size:13px;border-radius:8px}
.btn-primary{background:var(--ink);color:white;box-shadow:0 4px 14px rgba(26,22,18,.25)}
.btn-primary:hover{background:var(--accent);transform:translateY(-2px)}
.btn-secondary{background:var(--card);color:var(--ink);border:1.5px solid var(--border);box-shadow:var(--shadow)}
.btn-secondary:hover{border-color:var(--ink);transform:translateY(-2px)}
.btn-accent{background:var(--accent);color:white;box-shadow:0 4px 14px rgba(200,57,43,.3)}
.btn-accent:hover{background:#a82e22;transform:translateY(-2px)}
.btn-green{background:var(--green);color:white;box-shadow:0 4px 14px rgba(42,122,74,.3)}
.btn-green:hover{background:#1e5c38;transform:translateY(-2px)}
.section{padding:100px 48px}
.section-surface{background:var(--surface)}
.section-inner{max-width:1100px;margin:0 auto}
.section-label{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--accent);margin-bottom:12px}
.section-title{font-family:'Syne',sans-serif;font-weight:800;font-size:clamp(30px,3.5vw,44px);line-height:1.1;letter-spacing:-.02em;margin-bottom:16px}
.section-sub{font-size:16px;color:var(--ink2);line-height:1.7;max-width:520px;font-weight:300}
.scanner-layout{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start;margin-top:56px}
.scanner-box{background:var(--card);border:2px dashed var(--border);border-radius:20px;overflow:hidden;position:relative;transition:border-color .3s}
.scanner-box.scanning{border-color:var(--accent);border-style:solid}
.scanner-box.success{border-color:var(--green);border-style:solid}
.scanner-video{width:100%;display:block;border-radius:18px 18px 0 0;background:#0d0d0d;min-height:280px}
.scanner-overlay{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:32px;pointer-events:none}
.scanner-icon{width:72px;height:72px;border-radius:50%;background:rgba(200,57,43,.08);border:1.5px solid rgba(200,57,43,.2);display:flex;align-items:center;justify-content:center}
.scan-line{position:absolute;left:12%;right:12%;height:2px;background:linear-gradient(90deg,transparent,var(--accent),transparent);animation:scanMove 2.4s ease-in-out infinite;top:20%}
.scan-corners{position:absolute;inset:12%;pointer-events:none}
.scan-corners::before,.scan-corners::after,.scan-corners span::before,.scan-corners span::after{content:'';position:absolute;width:24px;height:24px;border-color:var(--accent);border-style:solid}
.scan-corners::before{top:0;left:0;border-width:3px 0 0 3px;border-radius:4px 0 0 0}
.scan-corners::after{top:0;right:0;border-width:3px 3px 0 0;border-radius:0 4px 0 0}
.scan-corners span::before{bottom:0;left:0;border-width:0 0 3px 3px;border-radius:0 0 0 4px}
.scan-corners span::after{bottom:0;right:0;border-width:0 3px 3px 0;border-radius:0 0 4px 0}
.scan-btn-area{padding:20px 24px;display:flex;gap:12px;align-items:center;border-top:1px solid var(--border)}
.scan-status{font-size:13px;color:var(--ink3);display:flex;align-items:center;gap:8px}
.dot-live{width:8px;height:8px;border-radius:50%;background:var(--ink3)}
.dot-live.active{background:var(--green);animation:pulse 1s infinite}
.scanner-placeholder-text{font-family:'Syne',sans-serif;font-size:15px;font-weight:600;color:var(--ink2);text-align:center}
.scanner-placeholder-sub{font-size:13px;color:var(--ink3);text-align:center}
.scanner-info{display:flex;flex-direction:column;gap:24px;padding-top:16px}
.info-step{display:flex;gap:18px;align-items:flex-start}
.step-num{width:36px;height:36px;border-radius:10px;background:var(--ink);color:white;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:700;font-size:14px}
.step-content h4{font-family:'Syne',sans-serif;font-weight:700;font-size:15px;margin-bottom:6px}
.step-content p{font-size:13px;color:var(--ink2);line-height:1.6}
.patients-header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:40px;flex-wrap:wrap;gap:20px}
.patients-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
.patient-card{background:var(--card);border-radius:16px;border:1px solid var(--border);padding:22px;cursor:pointer;transition:all .2s;box-shadow:var(--shadow)}
.patient-card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lg);border-color:var(--ink2)}
.pc-top{display:flex;align-items:center;gap:14px;margin-bottom:16px}
.pc-avatar{width:48px;height:48px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:700;font-size:18px;color:white;flex-shrink:0}
.pc-name{font-family:'Syne',sans-serif;font-weight:700;font-size:15px}
.pc-id{font-size:11px;color:var(--ink3);margin-top:2px}
.pc-badge{margin-left:auto;padding:3px 10px;border-radius:100px;font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
.badge-bloc{background:rgba(200,57,43,.1);color:var(--accent)}
.badge-standard{background:rgba(26,74,138,.1);color:var(--blue)}
.badge-soins{background:rgba(232,160,32,.1);color:var(--accent2)}
.pc-details{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding-top:14px;border-top:1px solid var(--border)}
.pc-detail label{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--ink3);font-weight:600}
.pc-detail span{font-size:12px;font-weight:500;display:block;margin-top:2px}
.pc-footer{margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;gap:8px}
.pc-btn{flex:1;padding:8px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid var(--border);background:transparent;color:var(--ink2);transition:all .18s;display:flex;align-items:center;justify-content:center;gap:6px;font-family:'DM Sans',sans-serif}
.pc-btn:hover{background:var(--ink);color:white;border-color:var(--ink)}
.pc-btn.print-btn:hover{background:var(--blue);color:white;border-color:var(--blue)}
.empty-state{grid-column:1/-1;text-align:center;padding:60px;color:var(--ink3)}
.modal-overlay{position:fixed;inset:0;z-index:200;background:rgba(26,22,18,.6);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;pointer-events:none;transition:opacity .3s}
.modal-overlay.open{opacity:1;pointer-events:all}
.modal{background:var(--card);border-radius:24px;width:100%;max-width:700px;max-height:90vh;overflow-y:auto;padding:40px;box-shadow:0 24px 80px rgba(26,22,18,.25);transform:translateY(24px);transition:transform .3s;scrollbar-width:thin}
.modal-overlay.open .modal{transform:translateY(0)}
.modal-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:32px}
.modal-title{font-family:'Syne',sans-serif;font-weight:800;font-size:26px}
.modal-sub{font-size:14px;color:var(--ink2);margin-top:6px}
.close-btn{width:40px;height:40px;border-radius:50%;border:1.5px solid var(--border);background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--ink2);font-size:18px;transition:all .2s;flex-shrink:0}
.close-btn:hover{background:var(--ink);color:white;border-color:var(--ink)}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.form-group{display:flex;flex-direction:column;gap:7px}
.form-group.full{grid-column:1/-1}
.form-group label{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink2)}
.form-group input,.form-group select,.form-group textarea{padding:12px 14px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--ink);transition:border-color .2s;outline:none}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:var(--ink)}
.form-group textarea{resize:vertical;min-height:80px}
.form-section-title{font-family:'Syne',sans-serif;font-weight:700;font-size:14px;grid-column:1/-1;padding-bottom:8px;border-bottom:1px solid var(--border);color:var(--ink2);margin-top:8px}
.form-actions{display:flex;gap:12px;justify-content:flex-end;margin-top:28px;padding-top:24px;border-top:1px solid var(--border)}
.dossier-modal{max-width:860px}
.dossier-hero{display:flex;gap:28px;align-items:flex-start;padding:28px;border-radius:16px;background:var(--bg);margin-bottom:28px;border:1px solid var(--border)}
.dossier-avatar{width:80px;height:80px;border-radius:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:30px;color:white}
.dossier-info{flex:1}
.dossier-name{font-family:'Syne',sans-serif;font-weight:800;font-size:26px;margin-bottom:6px}
.dossier-meta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px}
.meta-tag{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink2);background:var(--card);border:1px solid var(--border);border-radius:100px;padding:4px 12px}
.dossier-qr-section{display:flex;flex-direction:column;align-items:center;gap:12px;padding:20px;background:white;border-radius:14px;border:2px solid var(--border);flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.06)}
.qr-label{font-size:11px;color:var(--ink3);text-align:center;font-weight:500}
.print-qr-btn{font-size:12px;font-weight:600;color:var(--blue);background:rgba(26,74,138,.08);border:1.5px solid rgba(26,74,138,.2);border-radius:8px;padding:7px 14px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .2s;display:flex;align-items:center;gap:6px}
.print-qr-btn:hover{background:var(--blue);color:white;border-color:var(--blue)}
.dossier-sections{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.dossier-section{background:var(--bg);border-radius:14px;border:1px solid var(--border);padding:20px}
.dossier-section h4{font-family:'Syne',sans-serif;font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink3);margin-bottom:14px}
.dossier-section.full{grid-column:1/-1}
.ds-row{display:flex;justify-content:space-between;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border);gap:12px}
.ds-row:last-child{border-bottom:none}
.ds-label{font-size:12px;color:var(--ink3);font-weight:500;flex-shrink:0}
.ds-value{font-size:13px;font-weight:500;color:var(--ink);text-align:right}
.blood-badge{display:inline-block;background:rgba(200,57,43,.1);color:var(--accent);border-radius:6px;padding:2px 10px;font-weight:700;font-size:13px}
.allergy-tag{display:inline-block;background:rgba(232,160,32,.12);color:#9a6010;border-radius:100px;padding:2px 8px;font-size:11px;font-weight:600;margin:2px}
.chronic-tag{display:inline-block;background:rgba(26,74,138,.1);color:var(--blue);border-radius:100px;padding:2px 8px;font-size:11px;font-weight:600;margin:2px}
footer{background:var(--ink);color:rgba(255,255,255,.7);padding:40px 48px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px}
.footer-logo{font-family:'Syne',sans-serif;font-weight:800;font-size:20px;color:white}
.footer-logo span{color:var(--accent)}
footer p{font-size:13px}
@keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.7}}
@keyframes scanMove{0%,100%{top:20%;opacity:.8}50%{top:75%;opacity:1}}
@media print{
  .no-print{display:none!important}
  body>*{display:none}
  #print-area{display:flex!important;position:fixed;inset:0;align-items:center;justify-content:center}
  #print-area *{visibility:visible}
}
#print-area{display:none}
.bracelet{width:19cm;height:2.8cm;box-sizing:border-box;overflow:hidden;background:white;border:1px solid #333;border-radius:.22cm;padding:.14cm .2cm;font-family:'DM Sans',sans-serif}
.bracelet-header{display:flex;align-items:center;gap:.16cm;border-bottom:1px solid #ddd;padding-bottom:.06cm;margin-bottom:.08cm;line-height:1}
.bracelet-hospital{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}
.bracelet-body{display:flex;gap:.18cm;align-items:stretch}
.bracelet-qr{width:2.3cm;height:2.3cm;flex-shrink:0;background:#fff;padding:.02cm;border:1.5px solid #111;display:block;overflow:hidden}
.bracelet-qr canvas,.bracelet-qr img{width:100%!important;height:100%!important;display:block!important}
.bracelet-info{flex:1}
.bracelet-name{font-size:12px;font-weight:700;margin-bottom:2px;line-height:1.1}
.bracelet-detail{font-size:9px;color:#555;margin-bottom:1px;line-height:1.1}
.bracelet-blood{display:inline-block;background:#fee;border:1px solid #c33;color:#c33;border-radius:4px;padding:0 5px;font-size:9px;font-weight:700;margin-top:2px;line-height:1.2}
/* Search Patients Styles */
.search-header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:20px}
.search-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;padding:24px;background:var(--bg);border-radius:14px;border:1px solid var(--border);margin-bottom:24px}
.filter-group{display:flex;flex-direction:column;gap:8px}
.filter-group label{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--ink2)}
.search-input{padding:10px 12px;border-radius:8px;border:1.5px solid var(--border);background:var(--card);font-family:'DM Sans',sans-serif;font-size:14px;color:var(--ink);transition:border-color .2s;outline:none}
.search-input:focus{border-color:var(--ink)}
.search-results-info{font-size:14px;color:var(--ink2);margin-bottom:20px;font-weight:500}
.search-results-grid{display:grid;gap:12px;margin-bottom:24px}
.search-result-card{display:flex;align-items:center;gap:16px;padding:16px;background:var(--card);border-radius:12px;border:1.5px solid var(--border);cursor:pointer;transition:all .2s}
.search-result-card:hover{border-color:var(--ink);transform:translateX(4px);box-shadow:var(--shadow)}
.src-avatar{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:700;font-size:16px;color:white;flex-shrink:0}
.src-info{flex:1;min-width:0}
.src-name{font-family:'Syne',sans-serif;font-weight:700;font-size:14px;color:var(--ink)}
.src-id{font-size:11px;color:var(--ink3);margin-top:2px}
.src-meta{font-size:12px;color:var(--ink2);margin-top:4px}
.src-action{width:32px;height:32px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--ink3);flex-shrink:0}
/* Modal Footer */
.modal-footer{display:flex;gap:12px;justify-content:flex-end;margin-top:28px;padding-top:24px;border-top:1px solid var(--border)}
.modal-footer .btn{margin:0}
.form-full{grid-column:1/-1}
@media(max-width:900px){
  .nav{padding:16px 24px}
  .hero{grid-template-columns:1fr;padding:100px 24px 60px;gap:48px}
  .hero-visual{display:none}
  .section{padding:72px 24px}
  .scanner-layout{grid-template-columns:1fr}
  .dossier-sections{grid-template-columns:1fr}
  .dossier-hero{flex-direction:column}
  .form-grid{grid-template-columns:1fr}
  .form-group.full{grid-column:1}
  .search-filters{grid-template-columns:1fr}
  footer{padding:32px 24px}
}
`;

// ─── ICONS ────────────────────────────────────────────────────────────────────
const Icons = {
  QR: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="m14 14 3 3 4-4" />
    </svg>
  ),
  Plus: () => (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
  PlusSimple: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Camera: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M3 9a2 2 0 0 1 2-2h1l2-3h4l2 3h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  ),
  Check: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  File: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Print: () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  ),
  Stop: () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
    </svg>
  ),
};

// ─── HERO CARD ────────────────────────────────────────────────────────────────
// Uses a static QR image from the server for the first demo patient
function HeroCard() {
  const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
  return (
    <div className="hero-visual">
      <div className="hero-card-stack">
        <div className="hc-back2" />
        <div className="hc-back" />
        <div className="hero-card hc-main">
          <div className="hc-header">
            <div className="hc-avatar">AM</div>
            <div>
              <div className="hc-name">Ahmed Meziani</div>
              <div className="hc-dossier">Dossier #H-2025-0001</div>
            </div>
            <div className="hc-badge">Actif</div>
          </div>
          <div className="hc-grid">
            {[
              ["Groupe sanguin", "🩸 A+"],
              ["Date d'admission", "1 mars 2025"],
              ["Médecin traitant", "Dr. Benali S."],
              ["Allergie connue", "Pénicilline"],
            ].map(([label, value]) => (
              <div className="hc-field" key={label}>
                <label>{label}</label>
                <p>{value}</p>
              </div>
            ))}
          </div>
          <div className="hc-qr-row">
            <div className="hc-qr-preview">
              <img
                src={`${API}/storage/qr/H-2025-0001.png`}
                alt="QR H-2025-0001"
                width="120"
                height="120"
              />
            </div>
            <div className="hc-qr-text">
              <strong>Bracelet QR généré</strong>
              Imprimable — Format bracelet opératoire
              <br />
              <span
                style={{
                  fontSize: 11,
                  color: "var(--ink3)",
                  marginTop: 6,
                  display: "block",
                }}
              >
                Ouvrir l'URL sur votre téléphone, présenter à la caméra du PC
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── HERO SECTION ─────────────────────────────────────────────────────────────
function HeroSection({ patientCount, onNewPatient }) {
  return (
    <section className="hero no-print" id="hero">
      <div className="hero-bg" />
      <div className="hero-grid" />
      <div className="hero-content">
        <div className="hero-badge">
          <span className="badge-dot" />
          Système actif
        </div>
        <h1>
          Le dossier <em>patient</em>
          <br />
          au bout d'un <span className="underline-accent">scan</span>
        </h1>
        <p className="hero-sub">
          Chaque patient porte son dossier médical complet sur lui. Un simple
          scan du bracelet QR donne accès instantané à toutes les informations
          critiques.
        </p>
        <div className="hero-actions">
          <a href="#scanner" className="btn btn-primary">
            <Icons.QR />
            Scanner un QR
          </a>
          <button className="btn btn-secondary" onClick={onNewPatient}>
            <Icons.Plus />
            Nouveau patient
          </button>
        </div>
        <div className="hero-stats">
          <div className="stat-item">
            <div className="stat-num">{patientCount}</div>
            <div className="stat-label">Patients enregistrés</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">24/7</div>
            <div className="stat-label">Disponibilité</div>
          </div>
          <div className="stat-item">
            <div className="stat-num">&lt;1s</div>
            <div className="stat-label">Temps d'accès</div>
          </div>
        </div>
      </div>
      <HeroCard />
    </section>
  );
}

// ─── SCANNER SECTION ──────────────────────────────────────────────────────────
function ScannerSection({ onPatientFound }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState("En attente");
  const [boxState, setBoxState] = useState("");

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setBoxState("");
    setStatus("En attente");
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA)
      return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (!window.jsQR) return;
    const code = window.jsQR(imageData.data, imageData.width, imageData.height);
    if (code) {
      const scanned = code.data.trim();
      setStatus(`Code détecté: ${scanned}`);
      setBoxState("success");
      stopCamera();
      setTimeout(() => onPatientFound(scanned), 200);
    }
  }, [stopCamera, onPatientFound]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      setBoxState("scanning");
      setStatus("Caméra active — scan en cours...");
      intervalRef.current = setInterval(scanFrame, 300);
    } catch (e) {
      alert("Caméra inaccessible: " + e.message);
    }
  }, [scanFrame]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <section className="section section-surface no-print" id="scanner">
      <div className="section-inner">
        <div className="section-label">Scanner QR</div>
        <div className="section-title">
          Accès immédiat au
          <br />
          dossier patient
        </div>
        <p className="section-sub">
          Positionnez le bracelet QR du patient devant la caméra.
        </p>
        <div className="scanner-layout">
          <div>
            <div className={`scanner-box ${boxState}`}>
              <video
                ref={videoRef}
                className="scanner-video"
                autoPlay
                muted
                playsInline
              />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              {!active && (
                <div className="scanner-overlay">
                  <div className="scanner-icon">
                    <Icons.QR />
                  </div>
                  <div className="scanner-placeholder-text">
                    Caméra désactivée
                  </div>
                  <div className="scanner-placeholder-sub">
                    Cliquez sur "Activer la caméra" pour commencer
                  </div>
                </div>
              )}
              {active && (
                <>
                  <div className="scan-corners">
                    <span />
                  </div>
                  <div className="scan-line" />
                </>
              )}
            </div>
            <div className="scan-btn-area">
              <button
                className={`btn ${active ? "btn-secondary" : "btn-accent"}`}
                onClick={active ? stopCamera : startCamera}
              >
                {active ? <Icons.Stop /> : <Icons.Camera />}
                {active ? "Arrêter" : "Activer la caméra"}
              </button>
              <div className="scan-status">
                <span className={`dot-live ${active ? "active" : ""}`} />
                <span>{status}</span>
              </div>
            </div>
          </div>
          <div className="scanner-info">
            {[
              {
                n: 1,
                title: "Activez la caméra",
                desc: "Cliquez sur le bouton pour accéder à la caméra.",
              },
              {
                n: 2,
                title: "Ouvrez le QR sur votre téléphone",
                desc: "Ouvrez http://localhost:3001/storage/qr/H-2025-XXXX.png dans le navigateur de votre téléphone.",
              },
              {
                n: 3,
                title: "Présentez le téléphone à la caméra",
                desc: "Tenez l'écran du téléphone à 15–30 cm de la webcam du PC. Le dossier s'ouvre automatiquement.",
              },
              {
                n: 4,
                title: "Imprimez le bracelet",
                desc: "Depuis le dossier, imprimez le bracelet opératoire.",
                color: "var(--blue)",
              },
            ].map(({ n, title, desc, color }) => (
              <div className="info-step" key={n}>
                <div
                  className="step-num"
                  style={color ? { background: color } : {}}
                >
                  {n}
                </div>
                <div className="step-content">
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── PATIENT CARD ─────────────────────────────────────────────────────────────
function PatientCard({ patient: p, idx, onOpen, onPrint }) {
  return (
    <div className="patient-card" onClick={() => onOpen(p.id)}>
      <div className="pc-top">
        <div
          className="pc-avatar"
          style={{ background: p.color || COLORS[idx % COLORS.length] }}
        >
          {initials(p)}
        </div>
        <div>
          <div className="pc-name">
            {p.prenom} {p.nom}
          </div>
          <div className="pc-id">{p.display_id}</div>
        </div>
        <div className={`pc-badge ${getServiceBadgeClass(p.service)}`}>
          {p.service || "—"}
        </div>
      </div>
      <div className="pc-details">
        <div className="pc-detail">
          <label>Groupe sanguin</label>
          <span>{p.sang}</span>
        </div>
        <div className="pc-detail">
          <label>Âge</label>
          <span>{ageFromDob(p.dob)}</span>
        </div>
        <div className="pc-detail">
          <label>Médecin</label>
          <span>{p.medecin || "—"}</span>
        </div>
        <div className="pc-detail">
          <label>Admission</label>
          <span>{formatDate(p.admission)}</span>
        </div>
      </div>
      <div className="pc-footer">
        <button
          className="pc-btn"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(p.id);
          }}
        >
          <Icons.File />
          Dossier
        </button>
        <button
          className="pc-btn print-btn"
          onClick={(e) => {
            e.stopPropagation();
            onPrint(p);
          }}
        >
          <Icons.Print />
          Bracelet
        </button>
      </div>
    </div>
  );
}

// ─── PATIENTS SECTION ─────────────────────────────────────────────────────────
function PatientsSection({ patients, onNewPatient, onOpen, onPrint }) {
  return (
    <section className="section no-print" id="patients">
      <div className="section-inner">
        <div className="patients-header">
          <div>
            <div className="section-label">Registre</div>
            <div className="section-title">Patients enregistrés</div>
          </div>
          <button className="btn btn-primary" onClick={onNewPatient}>
            <Icons.PlusSimple />
            Nouveau patient
          </button>
        </div>
        <div className="patients-grid">
          {patients.length === 0 ? (
            <div className="empty-state">
              <p style={{ fontSize: 15, marginBottom: 8 }}>
                Aucun patient enregistré.
              </p>
              <p style={{ fontSize: 13 }}>
                Cliquez sur "Nouveau patient" pour commencer.
              </p>
            </div>
          ) : (
            patients.map((p, i) => (
              <PatientCard
                key={p.id}
                patient={p}
                idx={i}
                onOpen={onOpen}
                onPrint={onPrint}
              />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

// ─── ADD PATIENT MODAL ────────────────────────────────────────────────────────
const EMPTY_FORM = {
  prenom: "",
  nom: "",
  dob: "",
  sexe: "M",
  sang: "A+",
  admission: new Date().toISOString().split("T")[0],
  medecin: "",
  service: "Chirurgie générale",
  chronique: "",
  allergies: "",
  traitements: "",
  notes: "",
  tel: "",
  adresse: "",
};

function AddPatientModal({ open, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    if (!form.prenom.trim() || !form.nom.trim()) {
      alert("Le prénom et le nom sont obligatoires.");
      return;
    }
    onSave(form);
  };

  useEffect(() => {
    if (!open) setForm(EMPTY_FORM);
  }, [open]);

  return (
    <div
      className={`modal-overlay no-print ${open ? "open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Nouveau patient</div>
            <div className="modal-sub">
              Un QR code sera généré et enregistré automatiquement
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="form-grid">
          <div className="form-section-title">Identité</div>
          <div className="form-group">
            <label>Prénom *</label>
            <input
              value={form.prenom}
              onChange={set("prenom")}
              placeholder="Ahmed"
            />
          </div>
          <div className="form-group">
            <label>Nom *</label>
            <input
              value={form.nom}
              onChange={set("nom")}
              placeholder="Meziani"
            />
          </div>
          <div className="form-group">
            <label>Date de naissance</label>
            <input type="date" value={form.dob} onChange={set("dob")} />
          </div>
          <div className="form-group">
            <label>Sexe</label>
            <select value={form.sexe} onChange={set("sexe")}>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div className="form-group">
            <label>Téléphone</label>
            <input
              value={form.tel}
              onChange={set("tel")}
              placeholder="0555 00 00 00"
            />
          </div>
          <div className="form-group">
            <label>Adresse</label>
            <input
              value={form.adresse}
              onChange={set("adresse")}
              placeholder="Algérie"
            />
          </div>
          <div className="form-section-title">Informations médicales</div>
          <div className="form-group">
            <label>Groupe sanguin *</label>
            <select value={form.sang} onChange={set("sang")}>
              {BLOOD_GROUPS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Date d'admission</label>
            <input
              type="date"
              value={form.admission}
              onChange={set("admission")}
            />
          </div>
          <div className="form-group">
            <label>Médecin traitant</label>
            <input
              value={form.medecin}
              onChange={set("medecin")}
              placeholder="Dr. Benali Sofiane"
            />
          </div>
          <div className="form-group">
            <label>Service / Unité</label>
            <select value={form.service} onChange={set("service")}>
              {SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group full">
            <label>Maladies chroniques</label>
            <input
              value={form.chronique}
              onChange={set("chronique")}
              placeholder="Ex: Diabète type 2, Hypertension..."
            />
          </div>
          <div className="form-group full">
            <label>Allergies connues</label>
            <input
              value={form.allergies}
              onChange={set("allergies")}
              placeholder="Ex: Pénicilline, Aspirine, Latex..."
            />
          </div>
          <div className="form-group full">
            <label>Traitements en cours</label>
            <textarea
              value={form.traitements}
              onChange={set("traitements")}
              placeholder="Médicaments, posologie..."
            />
          </div>
          <div className="form-group full">
            <label>Notes / Observations</label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              placeholder="Observations particulières..."
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-green"
            onClick={handleSave}
            disabled={saving}
          >
            <Icons.Check />
            {saving ? "Enregistrement..." : "Enregistrer & Générer QR"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DOSSIER MODAL ────────────────────────────────────────────────────────────
function DossierModal({ patient: p, open, onClose, onPrint, onEdit }) {
  const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
  if (!p) return null;
  const m = p.medical || {};

  const allergyTags = (m.allergies || "Aucune").split(",").map((a) => (
    <span className="allergy-tag" key={a}>
      {a.trim()}
    </span>
  ));
  const chronicTags = (m.chronique || "Aucune").split(",").map((c) => (
    <span className="chronic-tag" key={c}>
      {c.trim()}
    </span>
  ));

  return (
    <div
      className={`modal-overlay no-print ${open ? "open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal dossier-modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Dossier Patient</div>
            <div className="modal-sub">Dossier N° {p.display_id}</div>
          </div>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="dossier-hero">
          <div
            className="dossier-avatar"
            style={{ background: p.color || COLORS[0] }}
          >
            {initials(p)}
          </div>
          <div className="dossier-info">
            <div className="dossier-name">
              {p.prenom} {p.nom}
            </div>
            <div className="dossier-meta">
              <div className="meta-tag">🗓 {formatDate(p.admission)}</div>
              <div className="meta-tag">
                👤 {ageFromDob(p.dob)} · {p.sexe === "M" ? "Homme" : "Femme"}
              </div>
              <div className="meta-tag">🏥 {p.service || "—"}</div>
              <div className="meta-tag">👨‍⚕️ {p.medecin || "—"}</div>
            </div>
          </div>
          <div className="dossier-qr-section">
            {p.qr?.qr_image_url ? (
              <img
                src={`${API}${p.qr.qr_image_url}`}
                alt={`QR ${p.display_id}`}
                width="140"
                height="140"
              />
            ) : (
              <div
                style={{
                  width: 140,
                  height: 140,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--ink3)",
                  fontSize: 12,
                }}
              >
                QR non généré
              </div>
            )}
            <div className="qr-label">QR Bracelet</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="print-qr-btn" onClick={() => onPrint(p)}>
                <Icons.Print />
                Imprimer bracelet
              </button>
              <button
                className="print-qr-btn"
                onClick={() => onEdit(p)}
                style={{ background: "var(--blue)", color: "white" }}
              >
                ✎ Modifier
              </button>
            </div>
          </div>
        </div>
        <div className="dossier-sections">
          <div className="dossier-section">
            <h4>Informations médicales</h4>
            <div className="ds-row">
              <span className="ds-label">Groupe sanguin</span>
              <span className="ds-value">
                <span className="blood-badge">{p.sang}</span>
              </span>
            </div>
            <div className="ds-row">
              <span className="ds-label">Allergies</span>
              <span className="ds-value">{allergyTags}</span>
            </div>
            <div className="ds-row">
              <span className="ds-label">Maladies chroniques</span>
              <span className="ds-value">{chronicTags}</span>
            </div>
          </div>
          <div className="dossier-section">
            <h4>Coordonnées</h4>
            <div className="ds-row">
              <span className="ds-label">Téléphone</span>
              <span className="ds-value">{p.tel || "—"}</span>
            </div>
            <div className="ds-row">
              <span className="ds-label">Adresse</span>
              <span className="ds-value">{p.adresse || "—"}</span>
            </div>
            <div className="ds-row">
              <span className="ds-label">Date de naissance</span>
              <span className="ds-value">{formatDate(p.dob)}</span>
            </div>
          </div>
          <div className="dossier-section full">
            <h4>Traitements en cours</h4>
            <p style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7 }}>
              {m.traitements || "Aucun traitement renseigné."}
            </p>
          </div>
          {m.notes && (
            <div className="dossier-section full">
              <h4>Notes &amp; Observations</h4>
              <p
                style={{ fontSize: 14, color: "var(--ink2)", lineHeight: 1.7 }}
              >
                {m.notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EDIT DOSSIER MODAL ───────────────────────────────────────────────────────
function EditDossierModal({ patient: p, open, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    if (p && open) {
      setForm({
        prenom: p.prenom || "",
        nom: p.nom || "",
        dob: p.dob || "",
        sexe: p.sexe || "M",
        sang: p.sang || "A+",
        admission: p.admission || "",
        medecin: p.medecin || "",
        service: p.service || "",
        chronique: p.medical?.chronique || "",
        allergies: p.medical?.allergies || "",
        traitements: p.medical?.traitements || "",
        notes: p.medical?.notes || "",
        tel: p.tel || "",
        adresse: p.adresse || "",
      });
    }
  }, [p, open]);

  const handleSave = async () => {
    if (!form.prenom.trim() || !form.nom.trim()) {
      alert("Le prénom et le nom sont obligatoires.");
      return;
    }
    onSave(form);
  };

  return (
    <div
      className={`modal-overlay no-print ${open ? "open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">Modifier le dossier patient</div>
            <div className="modal-sub">Dossier N° {p?.display_id}</div>
          </div>
          <button className="close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="form-grid">
          <div className="form-section-title">Identité</div>
          <div className="form-group">
            <label>Prénom *</label>
            <input
              value={form.prenom}
              onChange={set("prenom")}
              placeholder="Ahmed"
            />
          </div>
          <div className="form-group">
            <label>Nom *</label>
            <input
              value={form.nom}
              onChange={set("nom")}
              placeholder="Meziani"
            />
          </div>
          <div className="form-group">
            <label>Date de naissance</label>
            <input type="date" value={form.dob} onChange={set("dob")} />
          </div>
          <div className="form-group">
            <label>Sexe</label>
            <select value={form.sexe} onChange={set("sexe")}>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
          <div className="form-group">
            <label>Téléphone</label>
            <input
              value={form.tel}
              onChange={set("tel")}
              placeholder="0555 00 00 00"
            />
          </div>
          <div className="form-group">
            <label>Adresse</label>
            <input
              value={form.adresse}
              onChange={set("adresse")}
              placeholder="Algérie"
            />
          </div>
          <div className="form-section-title">Informations médicales</div>
          <div className="form-group">
            <label>Groupe sanguin *</label>
            <select value={form.sang} onChange={set("sang")}>
              {BLOOD_GROUPS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Date d'admission</label>
            <input
              type="date"
              value={form.admission}
              onChange={set("admission")}
            />
          </div>
          <div className="form-group">
            <label>Médecin traitant</label>
            <input
              value={form.medecin}
              onChange={set("medecin")}
              placeholder="Dr. Benali Sofiane"
            />
          </div>
          <div className="form-group">
            <label>Service / Unité</label>
            <select value={form.service} onChange={set("service")}>
              {SERVICES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Maladies chroniques</label>
            <input
              value={form.chronique}
              onChange={set("chronique")}
              placeholder="Diabète, Hypertension (séparées par des virgules)"
            />
          </div>
          <div className="form-group">
            <label>Allergies</label>
            <input
              value={form.allergies}
              onChange={set("allergies")}
              placeholder="Pénicilline, Sulfamides (séparées par des virgules)"
            />
          </div>
          <div className="form-group form-full">
            <label>Traitements en cours</label>
            <textarea
              value={form.traitements}
              onChange={set("traitements")}
              placeholder="Antibiothérapie, Anti-inflammatoires..."
              rows="4"
            />
          </div>
          <div className="form-group form-full">
            <label>Notes &amp; Observations</label>
            <textarea
              value={form.notes}
              onChange={set("notes")}
              placeholder="Notes additionnelles..."
              rows="3"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Enregistrement..." : "Enregistrer les modifications"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SEARCH PATIENTS ──────────────────────────────────────────────────────────
function SearchPatients({ patients, onPatientSelect }) {
  const [searchName, setSearchName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filteredPatients = patients.filter((p) => {
    const nameMatch = `${p.prenom} ${p.nom}`
      .toLowerCase()
      .includes(searchName.toLowerCase());

    let dateMatch = true;
    if (startDate || endDate) {
      const admission = new Date(p.admission);
      if (startDate) {
        const start = new Date(startDate);
        dateMatch = dateMatch && admission >= start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        dateMatch = dateMatch && admission <= end;
      }
    }

    return nameMatch && dateMatch;
  });

  return (
    <section className="section section-surface no-print" id="search">
      <div className="section-inner">
        <div className="search-header">
          <div>
            <div className="section-label">Recherche</div>
            <div className="section-title">Chercher un patient</div>
          </div>
          <button
            className={`btn ${showSearch ? "btn-secondary" : "btn-primary"}`}
            onClick={() => setShowSearch(!showSearch)}
          >
            {showSearch ? "Masquer la recherche" : "Afficher la recherche"}
          </button>
        </div>

        {showSearch && (
          <div className="search-filters">
            <div className="filter-group">
              <label>Nom ou Prénom</label>
              <input
                type="text"
                placeholder="Entrez le nom ou prénom..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-group">
              <label>Date d'admission (De)</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-group">
              <label>Date d'admission (À)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="search-input"
              />
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setSearchName("");
                setStartDate("");
                setEndDate("");
              }}
            >
              Réinitialiser
            </button>
          </div>
        )}

        {showSearch && (
          <>
            <div className="search-results-info">
              {searchName || startDate || endDate ? (
                <p>{filteredPatients.length} patient(s) trouvé(s)</p>
              ) : (
                <p style={{ color: "var(--ink3)" }}>
                  Entrez un critère de recherche
                </p>
              )}
            </div>

            {filteredPatients.length > 0 ? (
              <div className="search-results-grid">
                {filteredPatients.map((p, i) => (
                  <div
                    key={p.id}
                    className="search-result-card"
                    onClick={() => onPatientSelect(p.id)}
                  >
                    <div
                      className="src-avatar"
                      style={{
                        background: p.color || COLORS[i % COLORS.length],
                      }}
                    >
                      {initials(p)}
                    </div>
                    <div className="src-info">
                      <div className="src-name">
                        {p.prenom} {p.nom}
                      </div>
                      <div className="src-id">{p.display_id}</div>
                      <div className="src-meta">
                        📅 {formatDate(p.admission)} · 🏥 {p.service || "—"}
                      </div>
                    </div>
                    <div className="src-action">
                      <Icons.File />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchName || startDate || endDate ? (
              <div className="empty-state">
                <p>Aucun patient ne correspond à votre recherche.</p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

// ─── PRINT BRACELET ───────────────────────────────────────────────────────────
// Uses qrcodejs (CDN) to render QR inline for printing
function PrintArea({ patient: p }) {
  const qrRef = useRef(null);
  usePrintQR(qrRef, p?.display_id, 300);
  if (!p) return null;
  return (
    <div id="print-area" className="print-only">
      <div className="bracelet">
        <div className="bracelet-header">
          <div>
            <div className="bracelet-hospital">CHU</div>
            <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
              Portail MediScan
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: "#888" }}>
            {p.display_id}
          </div>
        </div>
        <div className="bracelet-body">
          <div ref={qrRef} className="bracelet-qr" />
          <div className="bracelet-info">
            <div className="bracelet-name">
              {p.prenom} {p.nom}
            </div>
            <div className="bracelet-detail">
              Admission: {formatDate(p.admission)}
            </div>
            <div className="bracelet-detail">Medecin: {p.medecin || "-"}</div>
            <div className="bracelet-detail">Service: {p.service || "-"}</div>
            {p.medical?.allergies && p.medical.allergies !== "Aucune" && (
              <div className="bracelet-detail" style={{ color: "#c33" }}>
                Allergie: {p.medical.allergies}
              </div>
            )}
            <div className="bracelet-blood">{p.sang}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function MediScan() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dossierPatient, setDossierPatient] = useState(null);
  const [printPatient, setPrintPatient] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const [editOpen, setEditOpen] = useState(false);

  // Inject global styles + CDN scripts
  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = GLOBAL_STYLES;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  useEffect(() => {
    // QRCode from CDN (still works)
    const qrSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    if (!document.querySelector(`script[src="${qrSrc}"]`)) {
      const s = document.createElement("script");
      s.src = qrSrc;
      document.head.appendChild(s);
    }

    // jsQR loaded locally (CDN was blocked)
    import("jsqr").then((mod) => {
      window.jsQR = mod.default;
      console.log("✅ jsQR loaded");
    });
  }, []);

  // ── Load patients from API on mount ────────────────────────────────────────
  useEffect(() => {
    loadPatients()
      .then((data) =>
        setPatients(
          data.map((p, i) => ({ ...p, color: COLORS[i % COLORS.length] })),
        ),
      )
      .catch((e) => console.error("loadPatients:", e))
      .finally(() => setLoading(false));
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleAddPatient = async (form) => {
    setSaving(true);
    try {
      const newPatient = await addPatient(form);
      const colored = {
        ...newPatient,
        color: COLORS[patients.length % COLORS.length],
      };
      setPatients((prev) => [colored, ...prev]);
      setAddOpen(false);
      setTimeout(() => setDossierPatient(colored), 200);
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEditDossier = async (form) => {
    if (!editPatient) return;
    setSaving(true);
    try {
      const updatedPatient = await updatePatient(editPatient.id, form);
      // Add color back to the updated patient
      const colored = {
        ...updatedPatient,
        color: editPatient.color,
      };
      // Update patients list
      setPatients((prev) =>
        prev.map((p) => (p.id === editPatient.id ? colored : p)),
      );
      // Update dossier view
      setDossierPatient(colored);
      setEditOpen(false);
      alert("Dossier mis à jour avec succès !");
    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  function playBeep() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.frequency.value = 1800; // sharp high pitch
    oscillator.type = "square"; // square wave = classic scanner
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 1.4); // 400ms = longer beep
  }

  const handleScanResult = useCallback(
    async (scannedId) => {
      playBeep();
      const found = await scanPatient(scannedId);
      if (found) {
        // Merge color from local state if available
        const local = patients.find((p) => p.display_id === scannedId);
        setDossierPatient({ ...found, color: local?.color || COLORS[0] });
      } else {
        alert(`Patient introuvable pour le code: ${scannedId}`);
      }
    },
    [patients],
  );

  const handlePrint = (patient) => {
    setPrintPatient(patient);
    setIsPrinting(true);
  };

  useEffect(() => {
    if (!isPrinting || !printPatient) return;
    const t = setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 350);
    return () => clearTimeout(t);
  }, [isPrinting, printPatient]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'DM Sans',sans-serif",
          fontSize: 16,
          color: "#8a8480",
        }}
      >
        Chargement des dossiers…
      </div>
    );
  }

  return (
    <>
      <nav className="nav no-print">
        <a href="#" className="nav-logo">
          <span className="nav-dot" />
          Medi<span className="logo-scan">Scan</span>
        </a>
        <div className="nav-links">
          <a href="#scanner">Scanner</a>
          <a href="#patients">Patients</a>
          <button className="nav-cta" onClick={() => setAddOpen(true)}>
            + Nouveau patient
          </button>
        </div>
      </nav>

      <HeroSection
        patientCount={patients.length}
        onNewPatient={() => setAddOpen(true)}
      />
      <ScannerSection onPatientFound={handleScanResult} />
      <SearchPatients
        patients={patients}
        onPatientSelect={(id) =>
          setDossierPatient(patients.find((p) => p.id === id) || null)
        }
      />
      <PatientsSection
        patients={patients}
        onNewPatient={() => setAddOpen(true)}
        onOpen={(id) =>
          setDossierPatient(patients.find((p) => p.id === id) || null)
        }
        onPrint={handlePrint}
      />

      <footer className="no-print">
        <div className="footer-logo">
          Medi<span>Scan</span>
        </div>
        <p>Portail de gestion des dossiers patients — CHU © 2025</p>
        <p style={{ fontSize: 12, opacity: 0.5 }}>
          Système interne — Accès réservé au personnel médical
        </p>
      </footer>

      <AddPatientModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={handleAddPatient}
        saving={saving}
      />
      <DossierModal
        patient={dossierPatient}
        open={!!dossierPatient}
        onClose={() => setDossierPatient(null)}
        onPrint={handlePrint}
        onEdit={(p) => {
          setEditPatient(p);
          setEditOpen(true);
        }}
      />
      <EditDossierModal
        patient={editPatient}
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setEditPatient(null);
        }}
        onSave={handleEditDossier}
        saving={saving}
      />
      {printPatient && <PrintArea patient={printPatient} />}
    </>
  );
}
