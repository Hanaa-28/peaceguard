import React, { useState, useEffect } from 'react';

// ── Config ──────────────────────────────────────────────────────────────────
// En dev avec Vite, le proxy redirige /analyze vers Flask sur :5000
// En prod, VITE_API_URL doit pointer vers le serveur Flask déployé
const API_URL = import.meta.env.VITE_API_URL || '';
const API_KEY = import.meta.env.VITE_API_KEY || 'Len@1oan';
const TOXICITY_THRESHOLD = 0.7; // score >= 0.7 → modal de révision

// ── Données ──────────────────────────────────────────────────────────────────
const BREAKING_NEWS = [
  "Nouvelle attaque terroriste dans le Sahel — bilan en cours",
  "Gouvernement annonce de nouvelles mesures de sécurité",
  "Économie en croissance malgré les défis sécuritaires"
];

const ARTICLES = [
  {
    id: 1,
    title: "Attaque dans le Nord : bilan lourd",
    excerpt: "Une attaque terroriste a fait plusieurs victimes dans la région du Sahel...",
    author: "Marie Ouédraogo",
    date: "9 mai 2026",
    category: "Sécurité",
    readCount: 1245,
    imageUrl: "https://images.unsplash.com/photo-1566438480900-0609be27a4be?w=600&q=80"
  },
  {
    id: 2,
    title: "Réformes économiques pour relancer l'agriculture",
    excerpt: "Le gouvernement présente un plan ambitieux pour soutenir les agriculteurs...",
    author: "Paul Zongo",
    date: "8 mai 2026",
    category: "Économie",
    readCount: 892,
    imageUrl: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=600&q=80"
  },
  {
    id: 3,
    title: "Festival culturel : célébration de la diversité",
    excerpt: "Ouagadougou accueille des artistes du monde entier pour un événement unique...",
    author: "Fatima Traoré",
    date: "7 mai 2026",
    category: "Culture",
    readCount: 567,
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80"
  },
  {
    id: 4,
    title: "Victoire historique en Coupe d'Afrique",
    excerpt: "L'équipe nationale remporte un match décisif contre ses adversaires...",
    author: "Jean-Baptiste Sawadogo",
    date: "6 mai 2026",
    category: "Sport",
    readCount: 2103,
    imageUrl: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&q=80"
  },
  {
    id: 5,
    title: "Élections présidentielles : campagne intense",
    excerpt: "Les candidats multiplient les meetings dans tout le pays...",
    author: "Amina Konaté",
    date: "5 mai 2026",
    category: "Politique",
    readCount: 1456,
    imageUrl: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=600&q=80"
  }
];

const FULL_ARTICLE = {
  title: "Situation sécuritaire au Burkina Faso : défis et réponses",
  author: "Marie Ouédraogo",
  date: "9 mai 2026",
  category: "Sécurité",
  imageUrl: "https://images.unsplash.com/photo-1566438480900-0609be27a4be?w=1200&q=80",
  paragraphs: [
    "La situation sécuritaire au Burkina Faso reste préoccupante, avec une recrudescence des attaques terroristes dans les régions du Sahel et du Nord. Ces derniers mois, plusieurs localités ont été touchées, entraînant des pertes humaines et des déplacements de populations. Le gouvernement, conscient de la gravité de la situation, a déployé des forces supplémentaires pour sécuriser les zones vulnérables.",
    "Les groupes armés terroristes, affiliés à des organisations internationales, exploitent les faiblesses des frontières poreuses et des zones désertiques pour mener leurs opérations. Les autorités burkinabè, en collaboration avec les pays voisins et les partenaires internationaux, mettent en œuvre des stratégies de lutte contre le terrorisme.",
    "Malgré ces efforts, les défis persistent. La population civile subit les conséquences directes de ces violences, avec des villages abandonnés et une économie locale affectée. Des programmes de soutien aux victimes et de reconstruction sont en cours.",
    "L'avenir de la sécurité au Burkina Faso dépend d'une approche holistique, combinant la force militaire avec le développement socio-économique et la diplomatie régionale."
  ],
  tags: ["Sécurité", "Sahel", "Burkina Faso", "Armée"]
};

const INITIAL_COMMENTS = [
  { id: 1, name: "Kofi Sawadogo",       date: "9 mai 2026", text: "La situation est vraiment inquiétante. Il faut plus d'actions concrètes pour protéger nos villages.", likes: 12, ai_result: 'skip' },
  { id: 2, name: "Amina Traoré",        date: "8 mai 2026", text: "Le gouvernement fait de son mieux, mais les terroristes sont partout. C'est décourageant.",          likes: 8,  ai_result: 'skip' },
  { id: 3, name: "Jean-Baptiste Zongo", date: "7 mai 2026", text: "Ces attaques sont inacceptables ! Il est temps de riposter avec force contre ces barbares.",          likes: 15, ai_result: 'skip' },
  { id: 4, name: "Fatima Konaté",       date: "6 mai 2026", text: "Pensez aux familles qui souffrent. Plus de solidarité et de soutien pour les victimes.",              likes: 20, ai_result: 'skip' },
  { id: 5, name: "Paul Ouédraogo",      date: "5 mai 2026", text: "Le Sahel est en feu, et personne ne fait rien ! C'est une honte internationale.",                    likes: 5,  ai_result: 'skip' }
];

const NAV_ITEMS = ["Accueil", "Politique", "Sécurité", "Économie", "Culture", "Sport"];

// ── Helpers localStorage ──────────────────────────────────────────────────────
const STORAGE_KEY = 'burkainfo_comments';

const loadComments = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Fusionne : commentaires initiaux en premier, puis les sauvegardés (nouveaux)
      const savedIds = new Set(parsed.map(c => c.id));
      const merged = [
        ...INITIAL_COMMENTS,
        ...parsed.filter(c => !INITIAL_COMMENTS.find(ic => ic.id === c.id))
      ];
      return merged;
    }
  } catch (_) {}
  return INITIAL_COMMENTS;
};

const saveComments = (comments) => {
  try {
    // Sauvegarde seulement les nouveaux commentaires (pas les initiaux)
    const toSave = comments.filter(c => !INITIAL_COMMENTS.find(ic => ic.id === c.id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (_) {}
};

// ── Composant principal ───────────────────────────────────────────────────────
const NewsPage = () => {
  const [comments,        setComments]        = useState(loadComments);
  const [activeNav,       setActiveNav]       = useState("Accueil");
  const [breakingIndex,   setBreakingIndex]   = useState(0);
  const [newName,         setNewName]         = useState("");
  const [newText,         setNewText]         = useState("");
  const [loading,         setLoading]         = useState(false);
  const [apiError,        setApiError]        = useState("");
  const [pendingReview,   setPendingReview]   = useState(null); // { comment, result, originalText }
  const [showModal,       setShowModal]       = useState(false);
  const [backendStatus,   setBackendStatus]   = useState("unknown"); // "ok" | "error" | "unknown"

  // ── Sauvegarde commentaires dans localStorage à chaque modification ──
  useEffect(() => {
    saveComments(comments);
  }, [comments]);

  // ── Vérifie que le backend est up au chargement ──
  useEffect(() => {
    fetch(`${API_URL}/health`, {
      headers: { 'X-API-Key': API_KEY }
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => setBackendStatus("ok"))
      .catch(() => setBackendStatus("error"));
  }, []);

  // ── Ticker ──
  useEffect(() => {
    const t = setInterval(() => {
      setBreakingIndex(i => (i + 1) % BREAKING_NEWS.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // ── Fonts + CSS global ──
  useEffect(() => {
    const l1 = Object.assign(document.createElement('link'), { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
    const l2 = Object.assign(document.createElement('link'), { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' });
    const l3 = Object.assign(document.createElement('link'), {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&family=Open+Sans:wght@400;600&display=swap'
    });
    const style = document.createElement('style');
    style.innerHTML = `
      * { box-sizing: border-box; }
      body { font-family: 'Open Sans', sans-serif; margin: 0; padding: 0; background: #f4f4f4; color: #222; }
      h1, h2, h3 { font-family: 'Merriweather', serif; }

      .ticker-wrap { overflow: hidden; white-space: nowrap; flex: 1; margin-left: 12px; }
      .ticker-text { display: inline-block; animation: tickerIn 0.6s ease; }
      @keyframes tickerIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

      .nav-link { margin: 0 10px; text-decoration: none; color: #ccc; font-size: 14px; cursor: pointer; transition: color .2s; user-select: none; }
      .nav-link:hover, .nav-link.active { color: #fff; }
      .nav-link.active { border-bottom: 2px solid #C0392B; padding-bottom: 2px; }

      .articles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 22px; }

      .article-card { background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.07); transition: transform .2s, box-shadow .2s; cursor: pointer; }
      .article-card:hover { transform: translateY(-3px); box-shadow: 0 6px 18px rgba(0,0,0,.12); }
      .card-img { width:100%; height:160px; object-fit:cover; display:block; }
      .card-img-fallback { width:100%; height:160px; display:none; align-items:center; justify-content:center; color:#fff; font-size:13px; }
      .card-body { padding: 14px; }

      .cat-badge { display:inline-block; padding:3px 10px; border-radius:20px; color:#fff; font-size:11px; font-weight:700; margin-bottom:8px; text-transform:uppercase; letter-spacing:.5px; }
      .cat-sécurité  { background: #C0392B; }
      .cat-économie  { background: #27AE60; }
      .cat-culture   { background: #8E44AD; }
      .cat-sport     { background: #E67E22; }
      .cat-politique { background: #2980B9; }

      .share-btn { padding:9px 16px; border:none; border-radius:6px; cursor:pointer; font-size:13px; font-weight:600; }
      .share-fb { background:#3B5998; color:#fff; }
      .share-tw { background:#1DA1F2; color:#fff; }
      .share-wa { background:#25D366; color:#fff; }

      .tag { background:#eef0f4; padding:5px 12px; border-radius:20px; font-size:12px; color:#555; }

      .comment-card { background:#fff; border-radius:10px; padding:16px 20px; box-shadow:0 1px 6px rgba(0,0,0,.06); }

      .like-btn   { background:#fff; border:1px solid #C0392B; color:#C0392B; padding:5px 12px; border-radius:20px; font-size:12px; cursor:pointer; transition:all .15s; }
      .like-btn:hover { background:#C0392B; color:#fff; }
      .report-btn { background:#f0f0f0; border:none; color:#888; padding:5px 12px; border-radius:20px; font-size:12px; cursor:pointer; }
      .report-btn:hover { background:#e0e0e0; }

      .ai-pill { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; }
      .ai-pill.non-toxique       { background:#d4edda; color:#155724; }
      .ai-pill.insulte           { background:#fff3cd; color:#856404; }
      .ai-pill.harcèlement       { background:#fff3cd; color:#856404; }
      .ai-pill.discrimination    { background:#f8d7da; color:#721c24; }
      .ai-pill.discours-haineux  { background:#f8d7da; color:#721c24; }
      .ai-pill.menace            { background:#f8d7da; color:#721c24; }
      .ai-pill.incitation        { background:#f8d7da; color:#721c24; }
      .ai-pill.pending           { background:#e9ecef; color:#6c757d; }
      .ai-pill.error             { background:#fff3cd; color:#856404; }

      .ai-zone { background:#1a1a2e; color:#fff; border-radius:10px; padding:24px; margin-top:24px; }
      .ai-stat { background:rgba(255,255,255,.08); border-radius:8px; padding:14px 18px; text-align:center; }
      .ai-stat-val   { font-size:28px; font-weight:700; font-family:'Merriweather',serif; }
      .ai-stat-label { font-size:12px; color:#aaa; margin-top:4px; }

      .comment-form input,
      .comment-form textarea { width:100%; padding:11px 14px; border:1px solid #ddd; border-radius:8px; font-family:'Open Sans',sans-serif; font-size:14px; outline:none; transition:border .2s; background:#fff; }
      .comment-form input:focus,
      .comment-form textarea:focus { border-color:#C0392B; }
      .submit-btn { background:#C0392B; color:#fff; border:none; padding:11px 28px; border-radius:8px; font-size:14px; font-weight:600; cursor:pointer; transition:background .2s; display:inline-flex; align-items:center; gap:8px; }
      .submit-btn:hover:not(:disabled) { background:#a93226; }
      .submit-btn:disabled { opacity:.6; cursor:not-allowed; }

      .hero-img { width:100%; height:340px; object-fit:cover; display:block; }

      /* Modal */
      .modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:1000; display:flex; align-items:center; justify-content:center; padding:20px; }
      .modal-box { background:#fff; border-radius:14px; max-width:600px; width:100%; padding:28px; box-shadow:0 20px 60px rgba(0,0,0,.25); }
      .modal-choice-btn { width:100%; padding:14px 16px; border-radius:8px; border:none; cursor:pointer; font-size:14px; font-family:'Open Sans',sans-serif; text-align:left; transition:background .15s; }

      /* Backend status badge */
      .status-badge { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; }
      .status-ok    { background:#d4edda; color:#155724; }
      .status-error { background:#f8d7da; color:#721c24; }
      .status-unknown { background:#e9ecef; color:#6c757d; }

      @media (max-width:700px) {
        .nav-desktop { display:none !important; }
        .header-date { display:none !important; }
        .hero-img { height:200px; }
      }
    `;
    [l1, l2, l3, style].forEach(el => document.head.appendChild(el));
    return () => { [l1, l2, l3, style].forEach(el => { try { document.head.removeChild(el); } catch(_){} }); };
  }, []);

  // ── Appel API Groq via Flask ─────────────────────────────────────────────────
  const analyzeComment = async (text) => {
    const response = await fetch(`${API_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY,
      },
      body: JSON.stringify({ text }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const msg = body?.error || body?.message || `Erreur HTTP ${response.status}`;
      throw new Error(msg);
    }

    if (!body || body.error) {
      throw new Error(body?.error || "Réponse invalide du serveur");
    }

    // Normalise le score : l'API renvoie 0-100, on convertit en 0-1
    let score = body.toxicity_score ?? body.score ?? 0;
    if (typeof score === 'string') score = parseFloat(score.replace(',', '.'));
    if (isNaN(score)) throw new Error("Score invalide reçu du backend");
    if (score > 1) score = score / 100;
    score = Math.min(Math.max(score, 0), 1);

    // Normalise le label
    const rawCategory = body.category || body.label || 'non toxique';
    const label = rawCategory
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');

    return {
      score,
      label,
      rawCategory,
      riskLevel:   body.risk_level || (score < 0.3 ? 'faible' : score < 0.6 ? 'moyen' : score < 0.8 ? 'élevé' : 'critique'),
      explanation: body.explanation || 'Analyse terminée.',
      rewrite:     body.peaceful_rewrite || body.rewrite || '',
      keywords:    body.keywords || [],
      emotions:    body.emotions || [],
    };
  };

  // ── Soumission commentaire ────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newText.trim()) return;

    const newComment = {
      id:   Date.now(),
      name: newName.trim(),
      date: new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
      text: newText.trim(),
      likes: 0,
      ai_result: null,
    };

    setApiError("");
    setLoading(true);

    try {
      const result = await analyzeComment(newText.trim());
      setLoading(false);

      // Commentaire toxique → modal de révision
      if (result.score >= TOXICITY_THRESHOLD) {
        setPendingReview({ comment: newComment, result, originalText: newText.trim() });
        setShowModal(true);
        return;
      }

      // Commentaire sain → publication directe
      publishComment({ ...newComment, ai_result: result });

    } catch (err) {
      setLoading(false);
      setApiError(err.message || "Erreur d'analyse. Vérifiez que le backend Flask est démarré.");
      // Fail-open : on publie quand même sans analyse
      publishComment({
        ...newComment,
        ai_result: { score: 0, label: 'error', rawCategory: 'Analyse indisponible', riskLevel: 'faible', explanation: `Analyse indisponible : ${err.message}`, rewrite: '', keywords: [], emotions: [] }
      });
    }
  };

  const publishComment = (comment) => {
    setComments(prev => [...prev, comment]);
    setNewName("");
    setNewText("");
    setLoading(false);
    setApiError("");
    setShowModal(false);
    setPendingReview(null);
  };

  // L'utilisateur choisit de publier le texte original ou la reformulation
  const handleReviewChoice = (chosenText) => {
    if (!pendingReview) return;
    const isRewrite = chosenText !== pendingReview.originalText;
    publishComment({
      ...pendingReview.comment,
      text: chosenText,
      // Si reformulation choisie : on marque publishedAsRewrite=true
      // Le badge ne montrera PAS l'analyse toxique dans ce cas
      ai_result: isRewrite
        ? { ...pendingReview.result, publishedAsRewrite: true }
        : pendingReview.result,
    });
  };

  const likeComment  = (id) => setComments(p => p.map(c => c.id === id ? { ...c, likes: c.likes + 1 } : c));
  const getCatClass  = (cat) => 'cat-' + cat.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const aiPillClass  = (label) => `ai-pill ${label || 'pending'}`;

  const analyzed     = comments.filter(c => c.ai_result && c.ai_result !== 'skip' && c.ai_result.label !== 'error' && !c.ai_result.publishedAsRewrite);
  const avgScore     = analyzed.length ? analyzed.reduce((s, c) => s + c.ai_result.score, 0) / analyzed.length : 0;
  const flaggedCount = analyzed.filter(c => c.ai_result.score >= TOXICITY_THRESHOLD).length;

  const riskEmoji = (score) => score >= 0.81 ? '🔴' : score >= 0.61 ? '🟠' : score >= 0.31 ? '🟡' : '🟢';

  // ── Rendu ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4' }}>

      {/* ── Breaking News ── */}
      <div style={{ background: '#C0392B', color: '#fff', padding: '8px 20px', display: 'flex', alignItems: 'center', fontSize: '13px' }}>
        <span style={{ background: 'rgba(0,0,0,.25)', padding: '2px 10px', borderRadius: '3px', fontWeight: 700, letterSpacing: '1px', flexShrink: 0, marginRight: '12px' }}>
          ⚡ FLASH
        </span>
        <div className="ticker-wrap">
          <span key={breakingIndex} className="ticker-text">{BREAKING_NEWS[breakingIndex]}</span>
        </div>
      </div>

      {/* ── Header ── */}
      <header style={{ background: '#1a1a2e', color: '#fff', padding: '0 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 64, boxShadow: '0 2px 8px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Merriweather,serif', letterSpacing: '-0.5px' }}>
            Burkina<span style={{ color: '#C0392B' }}>Info</span>
          </span>
          <span style={{ fontSize: 11, color: '#888', letterSpacing: '.5px' }}>L'actualité du Faso</span>
        </div>
        <nav className="nav-desktop" style={{ display: 'flex', alignItems: 'center' }}>
          {NAV_ITEMS.map(item => (
            <span key={item} onClick={() => setActiveNav(item)} className={`nav-link ${activeNav === item ? 'active' : ''}`}>{item}</span>
          ))}
        </nav>
        <div className="header-date" style={{ fontSize: 12, color: '#888' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </header>

      {/* ── Main ── */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 20px' }}>

        {/* Backend status */}
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`status-badge ${backendStatus === 'ok' ? 'status-ok' : backendStatus === 'error' ? 'status-error' : 'status-unknown'}`}>
            {backendStatus === 'ok'      && '✅ Backend Groq connecté'}
            {backendStatus === 'error'   && '❌ Backend hors ligne — démarrez Flask sur :5000'}
            {backendStatus === 'unknown' && '⏳ Vérification du backend...'}
          </span>
        </div>

        {/* ── Hero ── */}
        <section style={{ marginBottom: 36 }}>
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.08)' }}>
            <img src={ARTICLES[0].imageUrl} alt={ARTICLES[0].title} className="hero-img"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
            <div style={{ display: 'none', width: '100%', height: 340, background: 'linear-gradient(135deg,#C0392B,#922b21)', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 16 }}>
              🔒 Sécurité — Burkina Faso
            </div>
            <div style={{ padding: '24px 28px' }}>
              <span className={`cat-badge ${getCatClass(ARTICLES[0].category)}`}>{ARTICLES[0].category}</span>
              <h1 style={{ margin: '8px 0 12px', fontSize: 26, lineHeight: 1.35 }}>{ARTICLES[0].title}</h1>
              <p style={{ color: '#555', margin: '0 0 14px', fontSize: 15, lineHeight: 1.6 }}>{ARTICLES[0].excerpt}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#888' }}>
                  ✍️ {ARTICLES[0].author} &nbsp;·&nbsp; 📅 {ARTICLES[0].date} &nbsp;·&nbsp; 👁 {ARTICLES[0].readCount.toLocaleString()} vues
                </span>
                <button style={{ background: '#C0392B', color: '#fff', padding: '10px 22px', border: 'none', borderRadius: 7, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                  Lire la suite →
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Grille ── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ borderLeft: '4px solid #C0392B', paddingLeft: 12, marginBottom: 20, fontSize: 20, color: '#1a1a2e' }}>À la une</h2>
          <div className="articles-grid">
            {ARTICLES.map(a => (
              <div key={a.id} className="article-card">
                <img src={a.imageUrl} alt={a.title} className="card-img"
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                <div className="card-img-fallback" style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)' }}>{a.category}</div>
                <div className="card-body">
                  <span className={`cat-badge ${getCatClass(a.category)}`}>{a.category}</span>
                  <h3 style={{ margin: '6px 0 8px', fontSize: 15, lineHeight: 1.4 }}>{a.title}</h3>
                  <p style={{ color: '#666', fontSize: 13, margin: '0 0 10px', lineHeight: 1.5 }}>{a.excerpt}</p>
                  <div style={{ fontSize: 11, color: '#aaa' }}>{a.author} · {a.date} · 👁 {a.readCount.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Article complet ── */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ borderLeft: '4px solid #C0392B', paddingLeft: 12, marginBottom: 20, fontSize: 20, color: '#1a1a2e' }}>Article complet</h2>
          <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.08)', paddingBottom: 28 }}>
            <img src={FULL_ARTICLE.imageUrl} alt={FULL_ARTICLE.title} style={{ width: '100%', height: 300, objectFit: 'cover', display: 'block' }}
              onError={e => { e.target.style.background = 'linear-gradient(135deg,#C0392B,#922b21)'; e.target.removeAttribute('src'); }} />
            <div style={{ padding: '28px 32px' }}>
              <span className={`cat-badge ${getCatClass(FULL_ARTICLE.category)}`}>{FULL_ARTICLE.category}</span>
              <h1 style={{ fontSize: 24, margin: '10px 0 8px', lineHeight: 1.35 }}>{FULL_ARTICLE.title}</h1>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>✍️ {FULL_ARTICLE.author} &nbsp;·&nbsp; 📅 {FULL_ARTICLE.date}</div>
              {FULL_ARTICLE.paragraphs.map((p, i) => (
                <p key={i} style={{ color: '#444', lineHeight: 1.8, marginBottom: 16, fontSize: 15 }}>{p}</p>
              ))}
              <div style={{ display: 'flex', gap: 10, margin: '24px 0 16px', flexWrap: 'wrap' }}>
                <button className="share-btn share-fb">📘 Facebook</button>
                <button className="share-btn share-tw">🐦 Twitter</button>
                <button className="share-btn share-wa">💬 WhatsApp</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {FULL_ARTICLE.tags.map(t => <span key={t} className="tag"># {t}</span>)}
              </div>
            </div>
          </div>
        </section>

        {/* ── Commentaires ── */}
        <section>
          <h2 style={{ borderLeft: '4px solid #C0392B', paddingLeft: 12, marginBottom: 22, fontSize: 20, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 10 }}>
            Commentaires
            <span style={{ background: '#C0392B', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 13, fontFamily: 'Open Sans,sans-serif', fontWeight: 600 }}>
              {comments.length}
            </span>
          </h2>

          {/* Formulaire */}
          <div style={{ background: '#fff', borderRadius: 12, padding: 22, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, color: '#333' }}>Laisser un commentaire</h3>
            {apiError && (
              <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#856404' }}>
                ⚠️ {apiError}
              </div>
            )}
            <form className="comment-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Votre nom" required />
              <textarea value={newText} onChange={e => setNewText(e.target.value)} placeholder="Votre commentaire..." rows={4} required style={{ resize: 'vertical' }} />
              <div>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? (
                    <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 16 }}>⏳</span> Analyse en cours (Groq)...</>
                  ) : 'Publier le commentaire'}
                </button>
              </div>
            </form>
          </div>

          {/* Liste commentaires */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {comments.map(c => (
              <div key={c.id} className="comment-card" data-id={c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontWeight: 700, color: '#1a1a2e', fontSize: 14 }}>{c.name}</span>
                    <span style={{ color: '#aaa', fontSize: 12, marginLeft: 8 }}>{c.date}</span>
                  </div>
                  <button className="report-btn">Signaler</button>
                </div>
                <p style={{ color: '#444', lineHeight: 1.6, margin: '0 0 12px', fontSize: 14 }}>{c.text}</p>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                  <button className="like-btn" onClick={() => likeComment(c.id)}>👍 {c.likes}</button>
                  <div>
                    {/* Badge uniquement si : commentaire toxique ET publié tel quel (pas reformulé) */}
                    {c.ai_result && c.ai_result !== 'skip' && !c.ai_result.publishedAsRewrite && c.ai_result.score >= TOXICITY_THRESHOLD && (
                      <div>
                        <span className={aiPillClass(c.ai_result.label)}>
                          {riskEmoji(c.ai_result.score)} {c.ai_result.rawCategory || c.ai_result.label} — {Math.round(c.ai_result.score * 100)}/100
                        </span>
                        <div style={{ fontSize: 11, color: '#666', marginTop: 4, maxWidth: 500 }}>
                          {c.ai_result.explanation}
                        </div>
                        {c.ai_result.keywords?.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                            {c.ai_result.keywords.map((kw, i) => (
                              <span key={i} style={{ background: '#fff3cd', color: '#856404', padding: '1px 7px', borderRadius: 10, fontSize: 10 }}>{kw}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Zone statistiques IA */}
          {/* LLM INTEGRATION POINT — branché sur Groq via Flask /analyze */}
          <div className="ai-zone" data-hook="groq-llama-integration">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 18 }}>🤖</span>
              <h3 style={{ margin: 0, fontFamily: 'Merriweather,serif', fontSize: 16 }}>
                Tableau de bord — PeaceGuard AI (Groq · {ARTICLES[0] && 'llama-3.1-8b-instant'})
              </h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
              <div className="ai-stat">
                <div className="ai-stat-val" style={{ color: '#58a6ff' }}>{analyzed.length}</div>
                <div className="ai-stat-label">Commentaires analysés</div>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-val" style={{ color: avgScore >= 0.7 ? '#e74c3c' : avgScore >= 0.4 ? '#f39c12' : '#2ecc71' }}>
                  {analyzed.length ? Math.round(avgScore * 100) + '/100' : '—'}
                </div>
                <div className="ai-stat-label">Score moyen toxicité</div>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-val" style={{ color: flaggedCount > 0 ? '#e74c3c' : '#2ecc71' }}>{flaggedCount}</div>
                <div className="ai-stat-label">Commentaires signalés</div>
              </div>
              <div className="ai-stat">
                <div className="ai-stat-val" style={{ color: '#aaa' }}>{comments.length - analyzed.length}</div>
                <div className="ai-stat-label">En attente</div>
              </div>
            </div>
            <div style={{ marginTop: 14, fontSize: 11, color: '#555', borderTop: '1px solid rgba(255,255,255,.08)', paddingTop: 12 }}>
              🔌 Backend : <code style={{ background: 'rgba(255,255,255,.1)', padding: '1px 5px', borderRadius: 3 }}>Flask :5000 → Groq API → llama-3.1-8b-instant</code>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: '#1a1a2e', color: '#888', textAlign: 'center', padding: 20, fontSize: 13, marginTop: 20 }}>
        © 2026 BurkinaInfo — L'actualité du Faso en temps réel &nbsp;·&nbsp;
        <span style={{ color: '#4E9E91' }}>PeaceGuard AI</span> propulsé par Groq + Llama
      </footer>

      {/* ── Modal révision (commentaire toxique) ── */}
      {showModal && pendingReview && (
        <div className="modal-overlay" onClick={() => { setShowModal(false); setPendingReview(null); }}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'Merriweather,serif', fontSize: 18, marginBottom: 8, color: '#C0392B' }}>
              ⚠️ Contenu potentiellement problématique
            </h2>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
              PeaceGuard AI a détecté un contenu à risque dans votre commentaire
              (score : <strong>{Math.round(pendingReview.result.score * 100)}/100</strong> — {pendingReview.result.rawCategory}).
            </p>
            <div style={{ background: '#fff3cd', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#856404' }}>
              <strong>Explication :</strong> {pendingReview.result.explanation}
            </div>

            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Que souhaitez-vous publier ?</p>

            <button className="modal-choice-btn" style={{ background: '#f8d7da', color: '#721c24', marginBottom: 8 }}
              onClick={() => handleReviewChoice(pendingReview.originalText)}>
              📝 Publier mon texte original (tel quel)
            </button>

            {pendingReview.result.rewrite && (
              <button className="modal-choice-btn" style={{ background: '#d4edda', color: '#155724', marginBottom: 8 }}
                onClick={() => handleReviewChoice(pendingReview.result.rewrite)}>
                ✅ Publier la version reformulée pacifiquement<br />
                <em style={{ fontSize: 12, opacity: .85 }}>« {pendingReview.result.rewrite} »</em>
              </button>
            )}

            <button className="modal-choice-btn" style={{ background: '#f4f4f4', color: '#555' }}
              onClick={() => { setShowModal(false); setPendingReview(null); }}>
              ✏️ Modifier mon commentaire
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default NewsPage;