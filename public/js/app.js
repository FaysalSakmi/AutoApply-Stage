// ============================================================
// app.js — Validation côté client + soumission AJAX
// ============================================================

(function () {
    'use strict';

    // ── Références DOM ─────────────────────────────────────────
    const form = document.getElementById('apply-form');
    const feedback = document.getElementById('feedback');
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    const cvInput = document.getElementById('cv');
    const uploadZone = document.getElementById('upload-zone');
    const uploadVisual = document.getElementById('upload-visual');
    const uploadSelected = document.getElementById('upload-selected');
    const fileName = document.getElementById('file-name');
    const fileSize = document.getElementById('file-size');
    const removeBtn = document.getElementById('remove-file');
    const lettreArea = document.getElementById('lettre');
    const lettreCount = document.getElementById('lettre-count');

    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

    // ── Compteur de caractères lettre ──────────────────────────
    lettreArea.addEventListener('input', () => {
        lettreCount.textContent = lettreArea.value.length;
    });

    // ── Drag & Drop sur la zone d'upload ───────────────────────
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-over');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        const dt = e.dataTransfer;
        if (dt && dt.files.length > 0) {
            cvInput.files = dt.files;
            handleFileSelect(dt.files[0]);
        }
    });

    // ── Sélection de fichier via input ──────────────────────────
    cvInput.addEventListener('change', () => {
        if (cvInput.files.length > 0) {
            handleFileSelect(cvInput.files[0]);
        }
    });

    function handleFileSelect(file) {
        clearFieldError('cv');
        const sizeKB = (file.size / 1024).toFixed(1);
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        fileName.textContent = file.name;
        fileSize.textContent = file.size >= 1024 * 1024
            ? `${sizeMB} MB`
            : `${sizeKB} KB`;
        uploadVisual.classList.add('hidden');
        uploadSelected.classList.remove('hidden');
    }

    // ── Bouton "Supprimer le fichier" ───────────────────────────
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // empêche l'ouverture du sélecteur de fichier
        cvInput.value = '';
        uploadSelected.classList.add('hidden');
        uploadVisual.classList.remove('hidden');
        clearFieldError('cv');
    });

    // ── Validation côté client ──────────────────────────────────
    function validateForm() {
        let valid = true;

        // Nom
        const nom = document.getElementById('nom').value.trim();
        if (!nom || nom.length < 2) {
            showFieldError('nom', 'Le nom complet est requis (minimum 2 caractères).');
            valid = false;
        } else clearFieldError('nom');

        // Email
        const email = document.getElementById('email').value.trim();
        if (!email) {
            showFieldError('email', "L'adresse email est requise.");
            valid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showFieldError('email', "L'adresse email n'est pas valide.");
            valid = false;
        } else clearFieldError('email');

        // Téléphone
        const phone = document.getElementById('phone').value.trim();
        if (!phone) {
            showFieldError('phone', 'Le numéro de téléphone est requis.');
            valid = false;
        } else if (!/^[0-9\s+\-().]{8,20}$/.test(phone)) {
            showFieldError('phone', 'Le numéro de téléphone n\'est pas valide.');
            valid = false;
        } else clearFieldError('phone');

        // Type de stage
        const typeStage = document.getElementById('type-stage').value;
        if (!typeStage) {
            showFieldError('type-stage', 'Veuillez sélectionner un type de stage.');
            valid = false;
        } else clearFieldError('type-stage');

        // Date de début
        const dateDebut = document.getElementById('date-debut').value;
        if (!dateDebut) {
            showFieldError('date-debut', 'La date de début du stage est requise.');
            valid = false;
        } else clearFieldError('date-debut');

        // Date de fin
        const dateFin = document.getElementById('date-fin').value;
        if (!dateFin) {
            showFieldError('date-fin', 'La date de fin du stage est requise.');
            valid = false;
        } else if (dateDebut && dateFin <= dateDebut) {
            showFieldError('date-fin', 'La date de fin doit être postérieure à la date de début.');
            valid = false;
        } else clearFieldError('date-fin');

        // Lettre de motivation
        const lettre = lettreArea.value.trim();
        if (!lettre || lettre.length < 20) {
            showFieldError('lettre', 'La lettre de motivation est requise (minimum 20 caractères).');
            valid = false;
        } else clearFieldError('lettre');

        // CV
        const file = cvInput.files[0];
        if (!file) {
            showFieldError('cv', 'Veuillez joindre votre CV en format PDF.');
            valid = false;
        } else if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
            showFieldError('cv', 'Seuls les fichiers PDF sont acceptés.');
            valid = false;
        } else if (file.size > MAX_FILE_SIZE) {
            showFieldError('cv', 'Le fichier est trop volumineux. Maximum : 2 MB.');
            valid = false;
        } else clearFieldError('cv');

        return valid;
    }

    function showFieldError(fieldId, message) {
        const input = document.getElementById(fieldId);
        const errEl = document.getElementById(`${fieldId}-error`);
        if (input) input.classList.add('input-error');
        if (errEl) errEl.textContent = message;
    }

    function clearFieldError(fieldId) {
        const input = document.getElementById(fieldId);
        const errEl = document.getElementById(`${fieldId}-error`);
        if (input) input.classList.remove('input-error');
        if (errEl) errEl.textContent = '';
    }

    // ── Retour visuel : état de chargement ──────────────────────
    function setLoading(isLoading) {
        submitBtn.disabled = isLoading;
        btnText.classList.toggle('hidden', isLoading);
        btnLoader.classList.toggle('hidden', !isLoading);
    }

    // ── Affichage du feedback global ─────────────────────────────
    function showFeedback(type, content) {
        feedback.className = `feedback ${type}`;
        feedback.innerHTML = content;
        feedback.classList.remove('hidden');
        feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideFeedback() {
        feedback.classList.add('hidden');
        feedback.className = 'feedback hidden';
    }

    // ── Réinitialisation du formulaire ───────────────────────────
    function resetForm() {
        form.reset();
        lettreCount.textContent = '0';
        uploadSelected.classList.add('hidden');
        uploadVisual.classList.remove('hidden');
        ['nom', 'email', 'phone', 'type-stage', 'date-debut', 'date-fin', 'lettre', 'cv'].forEach(clearFieldError);
    }

    // ── Soumission AJAX ──────────────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideFeedback();

        if (!validateForm()) {
            showFeedback('error', '<strong>Veuillez corriger les erreurs ci-dessous avant de continuer.</strong>');
            return;
        }

        setLoading(true);

        const formData = new FormData(form);

        try {
            const response = await fetch('/api/apply', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                showFeedback('success',
                    `<strong>✅ ${data.message}</strong><br>
           <small>Nous examinerons votre dossier et vous contacterons très prochainement.</small>`
                );
                resetForm();
            } else {
                const errorList = Array.isArray(data.errors) && data.errors.length > 0
                    ? `<ul>${data.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
                    : '<p>Une erreur est survenue. Veuillez réessayer.</p>';
                showFeedback('error', `<strong>Erreur de soumission :</strong>${errorList}`);
            }
        } catch (err) {
            showFeedback('error',
                '<strong>Impossible de contacter le serveur.</strong><br>' +
                '<small>Vérifiez votre connexion internet et réessayez.</small>'
            );
        } finally {
            setLoading(false);
        }
    });

    // ── Utilitaire : échappement HTML (protection XSS côté client) ─
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(String(str)));
        return div.innerHTML;
    }

})();
