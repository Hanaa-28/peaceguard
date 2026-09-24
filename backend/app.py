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
GROQ_MODEL    = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "Len@1oan")

# ── Prompt système ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Tu es PeaceGuard AI, un assistant spécialisé dans la détection de discours haineux, toxicité, harcèlement et incitation à la violence.

Tu dois:

Analyser un texte fourni par l’utilisateur et produire une analyse claire et structurée afin de promouvoir une communication pacifique.

Règles d’analyse
Tu dois détecter si le texte contient :
insultes / harcèlement
discrimination
discours haineux (ethnie, religion, genre, nationalité, etc.)
menaces directes
incitation à la violence
agressivité excessive
Tu dois tenir compte du contexte :
éviter les faux positifs (ex : "ce film tue" n’est pas violent)
reconnaître les phrases figurées ou humoristiques
Tu dois attribuer un score de toxicité entre 0 et 100 :
0–30 : faible
31–60 : moyen
61–80 : élevé
81–100 : critique
Tu dois classifier la toxicité en une seule catégorie principale parmi :
"insulte"
"harcèlement"
"discrimination"
"discours haineux"
"menace"
"incitation à la violence"
"non toxique"

Tu dois proposer une reformulation pacifique du message :
neutre
respectueuse
non agressive
sans discrimination
conservant l’idée principale si possible
Tu dois rester neutre et ne jamais encourager la haine, la violence ou l’attaque contre un groupe.
 Format obligatoire de sortie

Tu dois répondre uniquement en JSON valide (sans texte autour).

Le JSON doit respecter exactement ce schéma :

{
  "toxic": true,
  "toxicity_score": 0,
  "risk_level": "faible",
  "category": "non toxique",
  "emotions": ["neutre"],
  "keywords": [],
  "explanation": "",
  "peaceful_rewrite": ""
}
Contraintes sur les champs
toxic : boolean
toxicity_score : integer (0 à 100)
risk_level : "faible" | "moyen" | "élevé" | "critique"
category : une seule valeur parmi la liste définie
emotions : tableau contenant 1 à 3 émotions maximum
keywords : tableau de mots/expressions exactes extraites du texte
explanation : 2 à 4 phrases maximum
peaceful_rewrite : phrase reformulée, respectueuse, claire"""


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
    """Appelle Groq (qween) pour analyser le texte."""
    if not GROQ_API_KEY:
        return {"error": "GROQ_API_KEY manquante dans le fichier .env"}

    try:
        client = Groq(api_key=GROQ_API_KEY)
        completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
        messages=[
      {
        "role": "user",
        "content": ""
      }
    ],
    temperature=1,
    max_completion_tokens=2048,
    top_p=1,
    reasoning_effort="medium",
    stream=True,
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
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)

