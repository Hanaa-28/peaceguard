# Prompt système — PeaceGuard AI

## Modèle utilisé
**Groq API** — `llama-3.1-8b-instant` (rapide, gratuit jusqu'à 30 000 tokens/min)

## Rôle du prompt
Ce prompt est injecté en tant que `system` message dans chaque appel à l'API Groq.
Il définit le comportement, les règles d'analyse et le format de sortie JSON attendu.

## Format de sortie JSON attendu

```json
{
  "toxic": true,
  "toxicity_score": 72,
  "risk_level": "élevé",
  "category": "insulte",
  "emotions": ["colère"],
  "keywords": ["mot1", "mot2"],
  "explanation": "Explication courte en 2 à 4 phrases.",
  "peaceful_rewrite": "Version reformulée pacifiquement."
}
```

## Niveaux de risque
| Score | Niveau |
|-------|--------|
| 0–30  | faible |
| 31–60 | moyen  |
| 61–80 | élevé  |
| 81–100| critique|

## Catégories
- `insulte`
- `harcèlement`
- `discrimination`
- `discours haineux`
- `menace`
- `incitation à la violence`
- `non toxique`
