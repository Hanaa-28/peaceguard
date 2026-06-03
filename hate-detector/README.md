# Hate Speech Detector — Plugin WordPress

Analyse automatiquement les commentaires via votre API LLM avant publication.

---

## Installation

1. **Copiez** le dossier `hate-detector/` dans `/wp-content/plugins/`
2. **Activez** le plugin depuis *Extensions → Extensions installées*
3. **Configurez** depuis *Réglages → Hate Detector*

---

## Configuration

| Champ | Description |
|---|---|
| URL de l'API | URL racine de votre API (ex: `https://votre-api.com`) |
| Clé API | Clé secrète envoyée dans le header `X-API-Key` |
| Seuil de blocage | Score entre 0 et 1 au-delà duquel le commentaire est bloqué (défaut: 0.7) |
| Action | `spam` (supprimé) ou `pending` (modération manuelle) |
| Timeout | Délai max d'attente de l'API en secondes (défaut: 10) |

---

## Ce que doit retourner votre API

L'endpoint `POST /analyze` doit accepter :

```json
{
  "text": "le contenu du commentaire"
}
```

Et retourner :

```json
{
  "score": 0.92,
  "label": "hateful",
  "keywords": ["mot1", "mot2"]
}
```

- `score` : flottant entre 0 et 1 (obligatoire)
- `label` : chaîne de caractères (optionnel)
- `keywords` : liste de mots-clés détectés (optionnel)

---

## Sécurité de votre API

Vérifiez le header `X-API-Key` dans votre backend :

**Flask :**
```python
from flask import request, abort

@app.route('/analyze', methods=['POST'])
def analyze():
    if request.headers.get('X-API-Key') != os.environ['API_SECRET_KEY']:
        abort(401)
    # ... votre logique
```

**FastAPI :**
```python
from fastapi import Header, HTTPException

@app.post("/analyze")
async def analyze(x_api_key: str = Header(None)):
    if x_api_key != settings.API_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    # ... votre logique
```

---

## Comportement en cas de panne

Si votre API est inaccessible (timeout, erreur réseau), le commentaire **passe normalement** (fail open). Ce choix est délibéré pour ne pas bloquer tous les commentaires si votre serveur est temporairement indisponible.

Pour changer ce comportement (fail closed), modifiez dans `hate-detector.php` :

```php
// Remplacer :
return $approved;
// Par :
return 'pending'; // met en attente si l'API est indisponible
```

---

## Structure des fichiers

```
hate-detector/
├── hate-detector.php          ← Point d'entrée, hooks WordPress
├── includes/
│   ├── class-analyzer.php     ← Appel HTTP à votre API
│   ├── class-admin.php        ← Page de configuration
│   └── class-logger.php       ← Logs en base de données
├── assets/
│   └── admin.css              ← Styles de l'admin
└── README.md
```
