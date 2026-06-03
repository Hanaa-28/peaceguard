(function () {
  "use strict";

  // ── Attendre que le DOM soit prêt ──────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("commentform");
    if (!form) return;

    injectModal();

    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const textarea = form.querySelector("#comment");
      if (!textarea || textarea.value.trim().length < 5) {
        form.submit();
        return;
      }

      const text = textarea.value.trim();

      try {
        showLoader(textarea);
        const result = await analyzeComment(text);
        hideLoader(textarea);

        if (result.score >= hsdData.threshold) {
          // Commentaire potentiellement haineux → afficher la modale
          const rewrite = result.rewrite || "";
          showModal(text, rewrite, result.score, function (chosenText) {
            textarea.value = chosenText;
            form.submit();
          });
        } else {
          // Commentaire sain → soumission normale
          form.submit();
        }
      } catch (err) {
        hideLoader(textarea);
        // En cas d'erreur API, on laisse passer (fail open)
        console.warn("[HSD] API indisponible, soumission directe.", err);
        form.submit();
      }
    });
  });

  // ── Appel à l'endpoint WordPress du plugin ─────────────────────────────────
  async function analyzeComment(text) {
    const response = await fetch(hsdData.ajaxUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        action: "hsd_analyze",
        nonce: hsdData.nonce,
        text: text,
      }),
    });

    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = await response.json();
    if (!data.success) throw new Error(data.data || "Erreur API");
    return data.data; // { score, label, keywords, rewrite }
  }

  // ── Loader discret sous le textarea ───────────────────────────────────────
  function showLoader(textarea) {
    if (document.getElementById("hsd-loader")) return;
    const div = document.createElement("div");
    div.id = "hsd-loader";
    div.textContent = "🔍 Analyse en cours…";
    div.style.cssText =
      "font-size:13px;color:#666;margin-top:6px;font-style:italic;";
    textarea.parentNode.insertBefore(div, textarea.nextSibling);
  }

  function hideLoader() {
    const el = document.getElementById("hsd-loader");
    if (el) el.remove();
  }

  // ── Modale ────────────────────────────────────────────────────────────────
  function injectModal() {
    const modal = document.createElement("div");
    modal.id = "hsd-modal";
    modal.innerHTML = `
      <div id="hsd-modal-box">
        <div id="hsd-modal-header">
          <span id="hsd-modal-icon">⚠️</span>
          <h2>Commentaire potentiellement offensant</h2>
        </div>

        <p id="hsd-modal-intro">
          Votre message a été détecté comme pouvant porter atteinte à autrui
          (score : <strong id="hsd-score-display"></strong>).
          Vous pouvez le publier tel quel ou utiliser la reformulation suggérée.
        </p>

        <div class="hsd-col-wrap">
          <div class="hsd-col">
            <label>Votre commentaire original</label>
            <div id="hsd-original-text" class="hsd-textbox"></div>
          </div>
          <div class="hsd-col">
            <label>Reformulation suggérée ✨</label>
            <div id="hsd-rewrite-text" class="hsd-textbox hsd-rewrite"></div>
          </div>
        </div>

        <div id="hsd-modal-actions">
          <button id="hsd-btn-original" class="hsd-btn hsd-btn-secondary">
            Publier mon commentaire original
          </button>
          <button id="hsd-btn-rewrite" class="hsd-btn hsd-btn-primary">
            Utiliser la reformulation ✨
          </button>
        </div>

        <p id="hsd-modal-note">
          En publiant votre commentaire original, vous assumez l'entière
          responsabilité de son contenu.
        </p>
      </div>
    `;
    document.body.appendChild(modal);

    // Fermer en cliquant hors de la boîte
    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });
  }

  function showModal(originalText, rewriteText, score, onChoose) {
    const modal = document.getElementById("hsd-modal");
    document.getElementById("hsd-original-text").textContent = originalText;
    document.getElementById("hsd-score-display").textContent =
      Math.round(score * 100) + "%";

    const rewriteEl = document.getElementById("hsd-rewrite-text");
    const btnRewrite = document.getElementById("hsd-btn-rewrite");

    if (rewriteText) {
      rewriteEl.textContent = rewriteText;
      btnRewrite.style.display = "inline-block";
    } else {
      rewriteEl.textContent = "Aucune reformulation disponible pour ce commentaire.";
      btnRewrite.style.display = "none";
    }

    // Bouton : publier l'original
    document.getElementById("hsd-btn-original").onclick = function () {
      closeModal();
      onChoose(originalText);
    };

    // Bouton : utiliser la reformulation
    btnRewrite.onclick = function () {
      closeModal();
      onChoose(rewriteText);
    };

    modal.classList.add("hsd-modal-open");
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    const modal = document.getElementById("hsd-modal");
    modal.classList.remove("hsd-modal-open");
    document.body.style.overflow = "";
  }
})();
