import re
import threading
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS, TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ---------------------------------------------------------------------------
# Dense retrieval (multilingual sentence encoder, lazy-loaded)
# ---------------------------------------------------------------------------
# The model (~470MB) is NOT imported at module load: _dense_model() builds it
# on first retrieval call and caches it process-wide. Corpus embeddings are
# pre-computed by backend/scripts/build_corpus_embeddings.py into
# data/corpus_embeddings.npz so serving only embeds the query (one small
# forward pass on CPU). If the npz is missing or stale, dense scoring is
# skipped and the sparse hybrid runs alone — retrieval never crashes.
DENSE_MODEL_NAME = "paraphrase-multilingual-MiniLM-L12-v2"
_DENSE_MODEL = None
_DENSE_MODEL_LOCK = threading.Lock()


def _dense_model():
    """Lazily load (and cache) the multilingual sentence encoder."""
    global _DENSE_MODEL
    if _DENSE_MODEL is None:
        with _DENSE_MODEL_LOCK:
            if _DENSE_MODEL is None:
                # This VM's no_proxy (e.g. "::1,[::1]") crashes httpx/hf-hub
                # parsing; sanitize before the client initializes (AGENTS.md).
                import os
                os.environ["NO_PROXY"] = "localhost,127.0.0.1"
                os.environ["no_proxy"] = "localhost,127.0.0.1"
                from sentence_transformers import SentenceTransformer
                _DENSE_MODEL = SentenceTransformer(DENSE_MODEL_NAME)
    return _DENSE_MODEL


def _load_corpus_embeddings(language: str, n_docs: int) -> np.ndarray | None:
    """Pre-computed doc embeddings, or None when missing/stale."""
    path = Path(__file__).parent / "data" / "corpus_embeddings.npz"
    try:
        data = np.load(path)
        emb = data[language]
    except (OSError, KeyError, ValueError):
        return None
    if emb.shape[0] != n_docs:
        return None  # corpus changed since the npz was built
    return emb.astype(np.float32)


# Raw-cosine relevance gate for the dense path. Calibrated 2026-10-11 on
# held-out questions vs unrelated probes: max irrelevant top-1 cosine was
# 0.227 ("python list comprehension tutorial"), min relevant EN/UR was 0.359.
# Without this gate, per-query min-max normalization promotes the best of an
# irrelevant set to 1.0 and unrelated questions leak answers.
DENSE_RELEVANCE_THRESHOLD = 0.30

# ---------------------------------------------------------------------------
# Tokenization (shared by TF-IDF and BM25 so both rankers see the same terms)
# ---------------------------------------------------------------------------
_TOKEN_RE = re.compile(r"(?u)\b\w\w+\b")  # unicode word chars, min length 2


def tokenize(text: str, language: str = "en") -> list[str]:
    """Lowercase unicode word tokens; English stop words dropped for EN."""
    tokens = _TOKEN_RE.findall(text.lower())
    if language == "en":
        tokens = [t for t in tokens if t not in ENGLISH_STOP_WORDS]
    return tokens


# ---------------------------------------------------------------------------
# BM25 (pure Python + numpy; no new dependencies)
# ---------------------------------------------------------------------------
class BM25:
    """Okapi BM25 over a static corpus. k1/b are the standard defaults."""

    def __init__(self, docs_tokens: list[list[str]], k1: float = 1.5,
                 b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.n_docs = len(docs_tokens)
        self.doc_lens = np.array([len(d) for d in docs_tokens], dtype=float)
        self.avg_len = self.doc_lens.mean() if self.n_docs else 1.0
        # document frequency per term
        df: dict[str, int] = {}
        for toks in docs_tokens:
            for t in set(toks):
                df[t] = df.get(t, 0) + 1
        self.idf = {t: float(np.log(1 + (self.n_docs - n + 0.5) / (n + 0.5)))
                    for t, n in df.items()}
        # term frequency per doc (list of dicts)
        self.tf = []
        for toks in docs_tokens:
            counts: dict[str, int] = {}
            for t in toks:
                counts[t] = counts.get(t, 0) + 1
            self.tf.append(counts)

    def score(self, query_tokens: list[str]) -> np.ndarray:
        scores = np.zeros(self.n_docs)
        if self.n_docs == 0:
            return scores
        norm = self.k1 * (1 - self.b + self.b * self.doc_lens / self.avg_len)
        for t in set(query_tokens):
            idf = self.idf.get(t)
            if idf is None:
                continue
            tf = np.array([d.get(t, 0) for d in self.tf], dtype=float)
            scores += idf * tf * (self.k1 + 1) / (tf + norm)
        return scores


# ---------------------------------------------------------------------------
# Roman Urdu handling
# ---------------------------------------------------------------------------
# Queries in Roman Urdu ("khane ke baad walk faida deti hai?") arrive as
# language="en" (Latin script) but match neither the English keywords nor the
# Urdu-script entries. Detection: Latin script + Roman-Urdu markers.
# Expansion: append English + Urdu-script synonyms so both indexes can hit.
_ROMAN_URDU_MARKERS = frozenset([
    "hai", "hain", "kya", "kia", "kyun", "kyu", "kaise", "kaisay", "kab", "kahan", "kitna", "kitne",
    "kitni", "mera", "meri", "mere", "mujhe", "mughay", "mujhay", "tumhe", "apko", "aapko", "chahiye", "chahye", "hota",
    "hoti", "hote", "wala", "wali", "walay", "mein", "me", "se", "say", "ne", "ko",
    "ki", "ka", "ke", "kay", "liye", "baad", "pehle", "pehlay", "faida", "nuqsan", "zyada", "ziada",
    "kam", "cheeni", "shugar", "shuger", "khana", "khane", "khaana", "peena", "sona", "neend", "pedal",
    "chalna", "chalnay", "ghanta", "ghantay", "ya", "aur", "bhi", "toh", "to", "karo", "karein", "karain",
    "karna", "achi", "achhi", "achha", "theek", "tabiyat", "sehat", "wazan",
])

# roman token -> "english synonyms + urdu-script synonyms"
_ROMAN_URDU_EXPANSIONS = {
    "khana": "meal food کھانا", "khane": "meal food کھانا",
    "khaana": "meal food کھانا",
    "peena": "drink پینا", "peene": "drink پینا",
    "cheeni": "sugar sugary شوگر", "chini": "sugar sugary شوگر",
    "shugar": "sugar blood glucose شوگر", "sugar": "sugar blood glucose شوگر", "shuger": "sugar blood glucose شوگر",
    "walk": "walking walk واک چہل قدمی", "sehal": "walking walk واک چہل قدمی", "sair": "walking walk واک چہل قدمی",
    "pedal": "walking walk exercise پیدل چہل قدمی", "chalnay": "walking walk چلنا چہل قدمی", "chalna": "walking walk چلنا چہل قدمی",
    "fiber": "fiber فائبر", "faibar": "fiber فائبر",
    "roti": "bread whole grains روٹی",
    "chawal": "rice چاول", "chaawal": "rice چاول",
    "roza": "fasting ramadan روزہ", "roze": "fasting ramadan روزہ",
    "ramzan": "ramadan رمضان", "ramadan": "ramadan رمضان",
    "neend": "sleep hours neend نیند", "sona": "sleep hours neend نیند سوئیں",
    "ghantay": "hours sleep neend نیند گھنٹے", "ghanta": "hours sleep neend نیند گھنٹہ",
    "tension": "stress ٹینشن", "pareshani": "stress پریشانی",
    "pani": "water hydration پانی", "paani": "water hydration پانی",
    "dawa": "medicine medication دوا", "dawai": "medicine medication دوا",
    "insulin": "insulin انسولین", "insuleen": "insulin انسولین",
    "subah": "morning fasting dawn صبح", "nashta": "breakfast ناشتہ",
    "raat": "night رات", "pair": "feet foot پاؤں",
    "kamzori": "weakness hypoglycemia کمزوری",
    "chakkar": "dizzy hypoglycemia چکر",
    "paseena": "sweat hypoglycemia پسینہ",
    "bhook": "hunger بھوک", "wazan": "weight وزن",
    "barh": "rise spike بڑھ", "barhta": "rise spike بڑھتا",
    "barhti": "rise spike بڑھتی", "barhna": "rise بڑھنا",
    "baad": "after بعد", "pehle": "before پہلے", "pehlay": "before پہلے",
    "sabzi": "vegetable salad سبزی", "salad": "vegetable salad سلاد",
    "phhal": "fruit پھل", "phal": "fruit پھل",
    "gosht": "meat protein گوشت", "anda": "egg انڈا",
    "doodh": "milk دودھ", "chai": "tea چائے",
    "juice": "juice drinks جوس", "sharbat": "drinks شربت",
    "tail": "oil fat تیل", "ghee": "fat گھی",
    "namak": "salt نمک", "meetha": "sweet میٹھا",
    "kasrat": "exercise physical activity ورزش", "warjish": "exercise physical activity ورزش",
    "achi": "good healthy بہتر اچھی", "achhi": "good healthy بہتر اچھی", "achha": "good healthy بہتر اچھا",
    "kia": "kya کیا", "mughay": "mujhe مجھے", "mujhay": "mujhe مجھے", "chahye": "chahiye چاہیے",
    "sehat": "health healthy صحت",
}


def is_roman_urdu(query: str) -> bool:
    """Latin-script query containing Roman-Urdu markers (not plain English)."""
    if re.search(r"[\u0600-\u06FF]", query):  # already Urdu script
        return False
    tokens = set(_TOKEN_RE.findall(query.lower()))
    return len(tokens & _ROMAN_URDU_MARKERS) >= 1


def expand_roman_urdu(query: str) -> str:
    """Append English/Urdu-script synonyms for recognized Roman Urdu tokens."""
    tokens = _TOKEN_RE.findall(query.lower())
    extra = []
    for t in tokens:
        exp = _ROMAN_URDU_EXPANSIONS.get(t)
        if exp:
            extra.append(exp)
    return query + " " + " ".join(extra) if extra else query


# ---------------------------------------------------------------------------
# Hybrid store: TF-IDF cosine + BM25 (+ optional dense), min-max normalized
# ---------------------------------------------------------------------------
class LocalVectorStore:
    """
    Lightweight local vector store: TF-IDF cosine similarity combined with
    Okapi BM25 as a hybrid score, optionally blended with multilingual dense
    cosine similarity.

    Sparse hybrid (dense_weight=0):
        bm25_weight * norm(bm25) + (1 - bm25_weight) * norm(tfidf)
    Dense hybrid (dense_weight>0, embeddings available):
        dense_weight * norm(dense) + (1 - dense_weight) * norm(bm25)

    Each component is min-max normalized across the corpus for the query.
    Weights are tuned on the held-out-safe tune split in
    tests/test_m8_retrieval.py (see BM25_WEIGHT / DENSE_WEIGHT in
    rag_service.py).
    """

    def __init__(self, language: str = "en", bm25_weight: float = 0.5,
                 dense_weight: float = 0.0):
        self.language = language
        self.bm25_weight = bm25_weight
        self.dense_weight = dense_weight
        self.documents = []
        self.clean_documents = []
        self.sources = []
        self.topics = []
        self.vectorizer = TfidfVectorizer(stop_words='english' if language == 'en' else None)
        self.vectors = None
        self.bm25: BM25 | None = None
        self._doc_embeddings: np.ndarray | None = None
        self._embeddings_checked = False  # lazy: load npz on first dense use

    def _get_doc_embeddings(self) -> np.ndarray | None:
        if not self._embeddings_checked:
            self._embeddings_checked = True
            self._doc_embeddings = _load_corpus_embeddings(
                self.language, len(self.documents))
        return self._doc_embeddings

    def _dense_scores(self, query: str) -> np.ndarray | None:
        """Cosine similarity of the query embedding vs corpus embeddings."""
        doc_emb = self._get_doc_embeddings()
        if doc_emb is None:
            return None
        model = _dense_model()
        q_emb = model.encode([query], normalize_embeddings=True,
                             show_progress_bar=False).astype(np.float32)
        return (q_emb @ doc_emb.T).flatten()

    def add_documents(self, documents: list[str], sources: list[str],
                      topics: list[str] | None = None,
                      display_documents: list[str] | None = None):
        """Index new documents into the vector store."""
        if not documents:
            return

        self.documents.extend(documents)
        self.clean_documents.extend(display_documents or documents)
        self.sources.extend(sources)
        self.topics.extend(topics or [""] * len(documents))

        # Re-compute vectors for all documents
        self.vectors = self.vectorizer.fit_transform(self.documents)
        self.bm25 = BM25([tokenize(d, self.language) for d in self.documents])

    def _hybrid_scores(self, query: str) -> np.ndarray:
        """Hybrid scores, each component min-max normalized per query.

        Dense path (dense_weight > 0, embeddings available, not Roman Urdu):
            dense_weight * norm(dense_cosine) + (1 - dense_weight) * norm(bm25),
            with docs below DENSE_RELEVANCE_THRESHOLD raw cosine zeroed out.
        Sparse path (default, and always for Roman Urdu): 
            bm25_weight * norm(bm25) + (1-bm25_weight) * norm(tfidf)

        Roman Urdu is routed to the sparse path: the multilingual encoder was
        not trained on Latin-script transliterations and measured worse on the
        Roman Urdu set (4/6 vs 6/6 sparse), while the synonym-expansion map was
        built for lexical matching.
        """
        roman = is_roman_urdu(query)
        if roman:
            query = expand_roman_urdu(query)
        q_tokens = tokenize(query, self.language)
        bm25_scores = self.bm25.score(q_tokens)

        def _norm(s: np.ndarray) -> np.ndarray:
            lo, hi = s.min(), s.max()
            if hi - lo < 1e-12:
                return np.zeros_like(s)
            return (s - lo) / (hi - lo)

        dense_scores = None
        if self.dense_weight > 0 and not roman:
            dense_scores = self._dense_scores(query)
        if dense_scores is not None:
            w = self.dense_weight
            hybrid = w * _norm(dense_scores) + (1 - w) * _norm(bm25_scores)
            hybrid[dense_scores < DENSE_RELEVANCE_THRESHOLD] = 0.0
            return hybrid

        query_vec = self.vectorizer.transform([query])
        tfidf_scores = cosine_similarity(query_vec, self.vectors).flatten()
        w = self.bm25_weight
        return w * _norm(bm25_scores) + (1 - w) * _norm(tfidf_scores)

    def search(self, query: str, top_k: int = 2) -> tuple[list[str], list[str]]:
        """Retrieve top_k documents most similar to the query."""
        if self.vectors is None or len(self.documents) == 0:
            return [], []

        scores = self._hybrid_scores(query)

        # Get top k indices sorted by highest similarity
        top_indices = np.argsort(scores)[-top_k:][::-1]

        matched_snippets = []
        matched_sources = []

        for idx in top_indices:
            if scores[idx] > 0.05:  # Threshold to ensure relevance
                matched_snippets.append(self.clean_documents[idx])
                if self.sources[idx] not in matched_sources:
                    matched_sources.append(self.sources[idx])

        return matched_snippets, matched_sources

    def search_with_topics(self, query: str, top_k: int = 2):
        """Like search(), but also returns the topic of each hit (WS3 eval)."""
        snippets, sources = self.search(query, top_k=top_k)
        if not snippets:
            return snippets, sources, []
        # recover topics by matching returned sources+snippets back to rows
        topics = []
        for snip, src in zip(snippets, sources):
            topic = ""
            for clean_doc, s, tp in zip(self.clean_documents, self.sources, self.topics):
                if clean_doc == snip and s == src:
                    topic = tp
                    break
            topics.append(topic)
        return snippets, sources, topics
