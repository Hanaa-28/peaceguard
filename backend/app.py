from flask import Flask, request, jsonify
import os
import json
import re
import traceback
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "X-API-Key"]
}})

@app.after_request
def add_cors_headers(response):
    response.headers.setdefault("Access-Control-Allow-Origin", "*")
    response.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    response.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
    return response

# ── Config ─────────────────────────────────────────────────────────
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL     = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "Len@1oan")

print(f"=== DEMARRAGE ===")
print(f"GROQ_MODEL     : {GROQ_MODEL}")
print(f"GROQ_API_KEY   : {'OK' if GROQ_API_KEY else 'MANQUANTE'}")
print(f"API_SECRET_KEY : {'OK' if API_SECRET_KEY else 'MANQUANTE'}")
print(f"=================")

SYSTEM_PROMPT = """Tu es PeaceGuard AI, expert en détection de discours haineux.
Analyse le texte et retourne UNIQUEMENT un JSON valide, sans texte autour, sans balises markdown.

{
  "toxic": true,
  "toxicity_score": 72,
  "risk_level": "élevé",
  "category": "insulte",
  "emotions": ["colère"],
  "keywords": ["mot1"],
  "explanation": "Explication courte.",
  "peaceful_rewrite": "Version reformulée."
}

Règles :
- toxic : boolean
- toxicity_score : integer 0 à 100
- risk_level : "faible" | "moyen" | "élevé" | "critique"
- category : "insulte" | "harcèlement" | "discrimination" | "discours haineux" | "menace" | "incitation à la violence" | "non toxique"
- explanation : 2 phrases max
- peaceful_rewrite : reformulation respectueuse"""


def parse_json_response(text):
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$", "", text, flags=re.MULTILINE)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find('{')
        end   = text.rfind('}')
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(text[start:end + 1])
            except json.JSONDecodeError:
                pass
    return {"error": "Impossible de parser la réponse JSON", "raw": text}


def analyze_text(text):
    print(f"[ANALYZE] Texte reçu : {text[:100]}")

    if not GROQ_API_KEY:
        print("[ANALYZE] ERREUR : GROQ_API_KEY manquante")
        return {"error": "GROQ_API_KEY manquante dans .env"}

    try:
        print(f"[ANALYZE] Appel Groq avec modèle : {GROQ_MODEL}")
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": text}
            ],
            temperature=0.3,
            max_completion_tokens=512,
            stream=False,
        )
        response_text = completion.choices[0].message.content
        print(f"[ANALYZE] Réponse Groq : {response_text[:200]}")
        result = parse_json_response(response_text)
        print(f"[ANALYZE] Résultat parsé : {result}")
        return result

    except Exception as e:
        print(f"[ANALYZE] ERREUR GROQ : {str(e)}")
        print(traceback.format_exc())
        return {"error": f"Erreur Groq API : {str(e)}"}


# ── Routes ─────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "model":  GROQ_MODEL,
        "groq_key_configured": bool(GROQ_API_KEY)
    })


@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze():
    print(f"[ROUTE] /analyze appelé — méthode : {request.method}")

    if request.method == 'OPTIONS':
        return '', 204

    # Vérification clé API
    client_key = request.headers.get('X-API-Key', '')
    print(f"[ROUTE] Clé reçue : '{client_key}' | Clé attendue : '{API_SECRET_KEY}'")

    if API_SECRET_KEY and client_key != API_SECRET_KEY:
        print("[ROUTE] ERREUR : Clé API invalide")
        return jsonify({"error": "Unauthorized"}), 401

    # Lecture du body
    try:
        data = request.get_json(silent=True)
        print(f"[ROUTE] Body reçu : {data}")
    except Exception as e:
        print(f"[ROUTE] ERREUR lecture body : {e}")
        return jsonify({"error": "Body invalide"}), 400

    if not data or 'text' not in data:
        print("[ROUTE] ERREUR : champ 'text' manquant")
        return jsonify({"error": "Champ 'text' manquant"}), 400

    text = data['text'].strip()
    if not text:
        return jsonify({"error": "Texte vide"}), 400

    try:
        result = analyze_text(text)
        if isinstance(result, dict) and 'error' in result:
            print(f"[ROUTE] Erreur dans result : {result}")
            return jsonify(result), 500
        print(f"[ROUTE] Succès — retourne 200")
        return jsonify(result), 200

    except Exception as e:
        print(f"[ROUTE] EXCEPTION : {str(e)}")
        print(traceback.format_exc())
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)