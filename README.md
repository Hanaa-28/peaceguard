# PeaceGuard AI — Guide de démarrage

Système de détection de discours haineux basé sur **Groq API** + **Llama 3.1**.

---

## Structure du projet

```
peaceguard/
├── backend/            ← API Flask (Python)
│   ├── app.py          ← Serveur principal
│   ├── .env            ← Clés API (ne pas commiter)
│   ├── requirements.txt
│   └── system_prompt.md
├── News/               ← Frontend React (Vite)
│   ├── src/
│   │   ├── main.jsx
│   │   └── NewsPage.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env
└── hate-detector/      ← Plugin WordPress (optionnel)
    ├── hate-detector.php
    ├── includes/
    └── assets/
```

---

## 1. Démarrer le backend Flask

```bash
cd backend

# Créer l'environnement virtuel
python -m venv venv
source venv/bin/activate       # Windows : venv\Scripts\activate

# Installer les dépendances
pip install -r requirements.txt

# Lancer le serveur
python app.py
```

Le backend tourne sur **http://127.0.0.1:5000**

### Test rapide
```bash
curl http://localhost:5000/health
# → {"status":"ok","model":"llama-3.1-8b-instant","groq_key_configured":true}

curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: Len@1oan" \
  -d '{"text": "Bonjour, comment allez-vous ?"}'
```

---

## 2. Démarrer le frontend React

```bash
cd News
npm install
npm run dev
```

Ouvre **http://localhost:5173**

Le proxy Vite redirige automatiquement `/analyze` → `http://127.0.0.1:5000/analyze`.

---

## 3. Configuration

### backend/.env
```
GROQ_API_KEY=votre_cle_groq
GROQ_MODEL=llama-3.1-8b-instant
API_SECRET_KEY=Len@1oan
```

Obtenir une clé Groq gratuite : https://console.groq.com/keys

### Changer de modèle Llama
Dans `backend/.env`, remplacez `GROQ_MODEL` par :
- `llama-3.1-8b-instant` — rapide, gratuit (recommandé)
- `llama-3.3-70b-versatile` — plus précis, plus lent
- `llama-3.1-70b-versatile` — compromis

---

## 4. Comment ça fonctionne

```
Utilisateur saisit un commentaire
        ↓
Frontend React appelle POST /analyze
        ↓
Flask reçoit le texte
        ↓
Groq API → Llama 3.1 analyse
        ↓
JSON retourné : { toxic, toxicity_score, risk_level, category,
                  emotions, keywords, explanation, peaceful_rewrite }
        ↓
Si score >= 0.7 → Modal de révision (publier original ou reformulé)
Si score < 0.7  → Publication directe avec badge IA
```

---

## 5. Plugin WordPress

1. Copier le dossier `hate-detector/` dans `wp-content/plugins/`
2. Activer le plugin dans WordPress Admin → Plugins
3. Configurer : Admin → Hate Speech Detector
   - **API URL** : `http://127.0.0.1:5000` (ou URL de votre serveur)
   - **API Key** : `Len@1oan`
   - **Seuil** : `0.7`

---

## 6. Format de réponse API

```json
{
  "toxic": true,
  "toxicity_score": 72,
  "risk_level": "élevé",
  "category": "insulte",
  "emotions": ["colère"],
  "keywords": ["mot1", "mot2"],
  "explanation": "Le texte contient...",
  "peaceful_rewrite": "Version reformulée..."
}
```
