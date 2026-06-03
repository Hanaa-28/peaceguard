from flask import Flask, request, jsonify
import os
import json
import re
from flask_cors import CORS
from dotenv import load_dotenv
from groq import Groq
import PyPDF2
from docx import Document


load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {
    "origins": [
        "http://localhost:5173",
        "https://peaceguard-gr4mes6gz-ardjata-hanaas-projects.vercel.app",   # ← ton URL Vercel
        "https://*.vercel.app"
    ],
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "X-API-Key"]
}})

@app.after_request
def add_cors_headers(response):
    response.headers.setdefault("Access-Control-Allow-Origin", "*")
    response.headers.setdefault("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    response.headers.setdefault("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
    return response

# ── Configuration ──────────────────────────────────────────────────────────────
GROQ_API_KEY  = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL    = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "Len@1oan")

# ── Prompt système ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Tu es PeaceGuard AI, un assistant spécialisé dans la détection de discours haineux, toxicité, harcèlement et incitation à la violence.

Tu dois analyser un texte fourni par l'utilisateur et produire une analyse claire et structurée afin de promouvoir une communication pacifique.

Règles d'analyse :
- Détecter si le texte contient : insultes, harcèlement, discrimination, discours haineux (ethnie, religion, genre, nationalité), menaces directes, incitation à la violence, agressivité excessive.
- Tenir compte du contexte : éviter les faux positifs (ex : "ce film tue" n'est pas violent), reconnaître les phrases figurées ou humoristiques.
- Attribuer un score de toxicité entre 0 et 100 : 0-30 = faible, 31-60 = moyen, 61-80 = élevé, 81-100 = critique.
- Classifier la toxicité en une seule catégorie parmi : "insulte", "harcèlement", "discrimination", "discours haineux", "menace", "incitation à la violence", "non toxique".
- Proposer une reformulation pacifique : neutre, respectueuse, non agressive, sans discrimination, conservant l'idée principale si possible.
- Rester neutre et ne jamais encourager la haine, la violence ou l'attaque contre un groupe.

Format de sortie OBLIGATOIRE : JSON valide uniquement, sans texte autour, sans balises markdown.

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

Contraintes :
- toxic : boolean
- toxicity_score : integer 0 à 100
- risk_level : "faible" | "moyen" | "élevé" | "critique"
- category : une seule valeur parmi la liste définie
- emotions : 1 à 3 émotions maximum
- keywords : mots/expressions exactes extraites du texte
- explanation : 2 à 4 phrases maximum
- peaceful_rewrite : phrase reformulée, respectueuse, claire"""


# ── Helpers ────────────────────────────────────────────────────────────────────

def parse_json_response(text: str) -> dict:
    """Extrait le JSON de la réponse du LLM même si du texte l'entoure."""
    text = text.strip()
    # Supprime les balises markdown ```json … ```
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


def extract_text_from_pdf(file) -> str:
    reader = PyPDF2.PdfReader(file)
    return "".join(page.extract_text() or "" for page in reader.pages)


def extract_text_from_docx(file) -> str:
    doc = Document(file)
    return "\n".join(p.text for p in doc.paragraphs)





def analyze_text(text: str) -> dict:
    """Appelle Groq (Llama) pour analyser le texte."""
    if not GROQ_API_KEY:
        return {"error": "GROQ_API_KEY manquante dans le fichier .env"}

    try:
        client = Groq(api_key=GROQ_API_KEY)
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": text}
            ],
            temperature=0.3,          # plus déterministe pour le JSON
            max_completion_tokens=1024,
            top_p=1,
            stream=False,
            stop=None
        )
        response_text = completion.choices[0].message.content
        return parse_json_response(response_text)

    except Exception as e:
        return {"error": f"Erreur Groq API : {str(e)}"}


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "ok",
        "model": GROQ_MODEL,
        "groq_key_configured": bool(GROQ_API_KEY)
    })


@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze():
    if request.method == 'OPTIONS':
        return '', 204

    # Vérification clé API
    if API_SECRET_KEY:
        client_key = request.headers.get('X-API-Key', '')
        if client_key != API_SECRET_KEY:
            return jsonify({"error": "Unauthorized"}), 401

    # ── Fichier uploadé ──
    if 'file' in request.files:
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "Aucun fichier sélectionné"}), 400

        filename = file.filename.lower()
        text = ""
        try:
            if filename.endswith('.pdf'):
                text = extract_text_from_pdf(file)
            elif filename.endswith('.docx'):
                text = extract_text_from_docx(file)
            elif filename.endswith(('.jpg', '.jpeg', '.png')):
                 return jsonify({"error": "Analyse d'images non disponible sur ce serveur"}), 400
            else:
                return jsonify({"error": "Type de fichier non supporté. Acceptés : PDF, DOCX, JPEG/PNG"}), 400
        except Exception as e:
            return jsonify({"error": f"Erreur extraction texte : {str(e)}"}), 500

        if not text.strip():
            return jsonify({"error": "Aucun texte trouvé dans le fichier"}), 400

    # ── Texte brut JSON ──
    else:
        data = request.get_json(silent=True)
        if not data or 'text' not in data:
            return jsonify({"error": "Champ 'text' manquant dans le corps JSON"}), 400
        text = data['text']

    if not text.strip():
        return jsonify({"error": "Le texte est vide"}), 400

    result = analyze_text(text)

    if isinstance(result, dict) and 'error' in result:
        return jsonify(result), 500

    return jsonify(result), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)
