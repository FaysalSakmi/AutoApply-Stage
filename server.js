// ============================================================
// server.js — Serveur Express pour les candidatures étudiantes
// ============================================================

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

let fetch;
try {
  fetch = require('node-fetch');
} catch (e) {
  try {
    fetch = globalThis.fetch;
  } catch (e2) {
    fetch = function() { return Promise.reject(new Error('fetch not available')); };
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── Dossiers indispensables ──────────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'candidatures.json');

try {
  [DATA_DIR, UPLOADS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
} catch (e) {
  console.error('[startup] Impossible de créer les dossiers/data :', e.message);
}

// ── Middleware ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ── Multer : upload sécurisé ─────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  }
});

const fileFilter = (_req, file, cb) => {
  const isPdf = file.mimetype === 'application/pdf' &&
    path.extname(file.originalname).toLowerCase() === '.pdf';
  if (isPdf) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'file'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 } // 2 MB
});

// ── Utilitaires de validation ────────────────────────────────

/** Supprime les balises HTML pour prévenir l'injection XSS */
function sanitize(str) {
  return String(str).trim().replace(/<[^>]*>/g, '');
}

/** Valide un email avec une regex standard */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Valide un numéro de téléphone (chiffres uniquement, 8–15 caractères) */
function isValidPhone(phone) {
  return /^[0-9\s+\-().]{8,20}$/.test(phone);
}

// ── Route POST /api/apply ────────────────────────────────────
app.post('/api/apply', (req, res, next) => {
  upload.single('cv')(req, res, (err) => {
    // ── Gestion erreurs Multer ──
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, errors: ['Le CV ne doit pas dépasser 2 MB.'] });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, errors: ['Seuls les fichiers PDF sont acceptés.'] });
      }
      return res.status(400).json({ success: false, errors: [`Erreur d'upload : ${err.message}`] });
    }
    if (err) return next(err);

    // ── Validation des champs ──
    const errors = [];
    const nom = sanitize(req.body.nom || '');
    const email = sanitize(req.body.email || '');
    const phone = sanitize(req.body.phone || '');
    const lettre = sanitize(req.body.lettre || '');
    const typeStage = sanitize(req.body.type_stage || '');
    const dateDebut = sanitize(req.body.date_debut || '');
    const dateFin = sanitize(req.body.date_fin || '');

    if (!nom || nom.length < 2) errors.push('Le nom complet est requis (minimum 2 caractères).');
    if (!email) errors.push('L\'adresse email est requise.');
    else if (!isValidEmail(email)) errors.push('L\'adresse email n\'est pas valide.');
    if (!phone) errors.push('Le numéro de téléphone est requis.');
    else if (!isValidPhone(phone)) errors.push('Le numéro de téléphone n\'est pas valide.');
    if (!typeStage) errors.push('Le type de stage est requis.');
    if (!dateDebut) errors.push('La date de début du stage est requise.');
    if (!dateFin) errors.push('La date de fin du stage est requise.');
    if (dateDebut && dateFin && dateFin <= dateDebut)
      errors.push('La date de fin doit être postérieure à la date de début.');
    if (!lettre || lettre.length < 20)
      errors.push('La lettre de motivation est requise (minimum 20 caractères).');
    if (!req.file)
      errors.push('Le CV (PDF) est obligatoire.');

    // Si erreurs, supprimer le fichier uploadé si présent
    if (errors.length > 0) {
      if (req.file) fs.unlink(req.file.path, () => { });
      return res.status(400).json({ success: false, errors });
    }

    // ── Sauvegarde de la candidature ──
    const candidature = {
      id: uuidv4(),
      nom,
      email,
      phone,
      typeStage,
      dateDebut,
      dateFin,
      lettre,
      cvFile: req.file.filename,
      createdAt: new Date().toISOString()
    };

    try {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      data.push(candidature);
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (writeErr) {
      return next(writeErr);
    }

    // ── Appel vers n8n (webhook) — multipart/form-data avec le PDF en binaire ──
    const N8N_WEBHOOK = 'https://mirta-unnosed-insuperably.ngrok-free.dev/webhook-test/etudiant';
    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('id', candidature.id);
      form.append('nom', candidature.nom);
      form.append('email', candidature.email);
      form.append('phone', candidature.phone);
      form.append('type_stage', candidature.typeStage);
      form.append('date_debut', candidature.dateDebut);
      form.append('date_fin', candidature.dateFin);
      form.append('lettre', candidature.lettre);
      form.append('createdAt', candidature.createdAt);
      // Attach the actual PDF binary
      form.append('cv', fs.createReadStream(req.file.path), {
        filename: req.file.originalname,
        contentType: 'application/pdf'
      });

      fetch(N8N_WEBHOOK, {
        method: 'POST',
        body: form,
        headers: form.getHeaders()   // sets Content-Type: multipart/form-data; boundary=…
      })
        .then(r => console.log(`[n8n] Webhook appelé — statut : ${r.status}`))
        .catch(e => console.error('[n8n] Erreur webhook :', e.message));
    } catch (formErr) {
      console.error('[n8n] Impossible de construire le formulaire :', formErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Votre candidature a été envoyée avec succès.'
    });
  });
});

// ── Gestionnaire d'erreurs global ────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[Erreur serveur]', err.message);
  res.status(500).json({ success: false, errors: ['Erreur interne du serveur. Veuillez réessayer.'] });
});

// ── Export pour Passenger (Serv00) ou démarrage direct ──────
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅  Serveur démarré sur http://0.0.0.0:${PORT}\n`);
  });
}
module.exports = app;
