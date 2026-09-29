"""Recommendations as a vector search over the precomputed catalog (catalog.py).

Every catalog book has an embedding of its title, genres and description. A
request builds the reader's taste from their own books, weighted by rating, then
ranks the whole catalog in memory, with no external API calls. Only books missing
from the catalog (e.g. added since the last refresh) get embedded on the fly.

- recommend(): books closest to the reader's taste clusters (so different tastes
  aren't averaged together), pushed away from books they disliked, with a small
  boost for popular books and a diversity pass. Each result says which of the
  reader's books it's most like ("related_to").
- opposite(): well-regarded books far from everything the reader has read,
  spread across genres.
- similar(): books closest to one book.
"""
import datetime
import math
import re
import threading

import numpy as np

from catalog import CATALOG_COLLECTION, book_key, embedding_text, get_db
from models import SENTENCE_MODEL_NAME, get_sentence_model

RELOAD_CHECK_SECONDS = 15 * 60
MAX_TASTE_CLUSTERS = 4
UNRATED_WEIGHT = 0.35  # a book someone chose to read, but didn't rate, is a mild positive
NEGATIVE_PENALTY = 0.25
POPULARITY_BOOST = 0.08
SAME_AUTHOR_BOOST = 0.15  # readers often read several books by an author they like
NEAREST_LIKED = 3  # score also counts closeness to the reader's 3 closest liked books
DIVERSITY_LAMBDA = 0.75  # 1.0 = pure relevance, lower = more varied picks
NEAR_DUPLICATE_SIMILARITY = 0.95  # other editions of a book the reader already has
MAX_PER_AUTHOR = 3  # 4+ scored higher in evaluate_recs.py, but lists got repetitive


class Catalog:
    def __init__(self, docs):
        docs = [d for d in docs if d.get('embedding')]
        self.books = docs
        self.vectors = (np.frombuffer(b''.join(d['embedding'] for d in docs), dtype=np.float32)
                        .reshape(len(docs), -1) if docs else np.zeros((0, 384), dtype=np.float32))
        self.index_by_key = {d['_id']: i for i, d in enumerate(docs)}
        self.index_by_isbn = {isbn: i for i, d in enumerate(docs) for isbn in d.get('isbns') or []}
        self.popularity = np.array([popularity(d) for d in docs], dtype=np.float32)
        self.genre = [primary_genre(d) for d in docs]
        self.recommendable = np.array([is_recommendable(d) for d in docs], dtype=bool)
        self.for_children = np.array([is_for_children(d) for d in docs], dtype=bool)
        self.authors = [{a.lower() for a in d.get('authors') or []} for d in docs]
        self.base_titles = [base_title(d.get('title')) for d in docs]
        self.loaded_at = datetime.datetime.utcnow()

    def find(self, book):
        """Catalog index for one of the reader's books, by ISBN, then title+author."""
        isbn = book.get('isbn')
        if isbn and isbn in self.index_by_isbn:
            return self.index_by_isbn[isbn]
        authors = book.get('authors')
        authors = [authors] if isinstance(authors, str) else authors
        return self.index_by_key.get(book_key(book.get('title'), authors))


def popularity(doc):
    """0-1 prior: bestseller runs, Google ratings volume, and how many Booked readers have it."""
    score = 0.0
    if doc.get('bestsellerWeeks'):
        score += 0.5 + min(doc['bestsellerWeeks'], 20) / 40
    score += 0.4 * min(math.log1p(doc.get('ratingsCount') or 0) / math.log1p(500), 1)
    score += 0.2 * min(doc.get('inLibraries') or 0, 3) / 3
    return min(score, 1.0)


LATER_VOLUME = re.compile(r'\b(?:vol\.?|volume)\s*(\d+|[a-z]+)\b', re.IGNORECASE)
NUMBER_WORDS = {w: n for n, w in enumerate(
    'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen '
    'sixteen seventeen eighteen nineteen twenty'.split())}
CHILDREN = re.compile(r"children|picture book|middle grade|juvenile", re.IGNORECASE)
SERIES_LIST = re.compile(r'\bseries\b', re.IGNORECASE)
NOT_A_READ = re.compile(
    r'word search|crossword|sudoku|puzzle|coloring|colouring|activity book|sticker|journal\b|planner|'
    r'workbook|calendar|notebook|study guide|test prep|cliffsnotes|sparknotes', re.IGNORECASE)


def is_recommendable(doc):
    """Skip volume 2+ of a series, and NYT "series" list entries (series names, not books)."""
    match = LATER_VOLUME.search(doc.get('title') or '')
    if match:
        number = match.group(1).lower()
        number = int(number) if number.isdigit() else NUMBER_WORDS.get(number, 0)
        if number > 1:
            return False
    categories = doc.get('categories') or []
    if NOT_A_READ.search(' '.join([doc.get('title') or ''] + categories)):
        return False  # puzzle books, journals, study guides
    if doc.get('sources') == ['nyt'] and categories and all(SERIES_LIST.search(c) for c in categories):
        return False
    return True


def base_title(title):
    """Lowercase title without punctuation, for spotting editions with longer titles."""
    return re.sub(r'[^a-z0-9]+', ' ', (title or '').lower()).strip()


def is_for_children(doc):
    return any(CHILDREN.search(c) for c in (doc.get('categories') or []) + (doc.get('subjects') or []))


def primary_genre(doc):
    for field in ('subjects', 'categories'):
        values = doc.get(field) or []
        if values:
            return values[0].split('/')[0].strip().lower()
    return 'other'


_catalog = None
_catalog_lock = threading.Lock()


def get_catalog(force=False):
    """The in-memory catalog, reloaded when a refresh has changed it."""
    global _catalog
    with _catalog_lock:
        now = datetime.datetime.utcnow()
        if _catalog is not None and not force:
            if (now - _catalog.loaded_at).total_seconds() < RELOAD_CHECK_SECONDS:
                return _catalog
            latest = get_db()[CATALOG_COLLECTION].find_one({}, {'updatedAt': 1}, sort=[('updatedAt', -1)])
            if not latest or latest['updatedAt'] <= _catalog.loaded_at:
                _catalog.loaded_at = now
                return _catalog
        # Only vectors from the current model; mixing models would make similarities meaningless
        docs = get_db()[CATALOG_COLLECTION].find(
            {'embedding': {'$exists': True}, 'embeddingModel': SENTENCE_MODEL_NAME}, {'embeddingTextHash': 0})
        _catalog = Catalog(list(docs))
        return _catalog


# ---------- the reader's taste ----------

def rating_weight(book):
    rating = book.get('rating')
    if not isinstance(rating, (int, float)):
        return UNRATED_WEIGHT
    return (rating - 50) / 50  # 100 -> 1, 50 -> 0, 0 -> -1


def reader_vectors(catalog, books):
    """(vectors, weights, books) for the reader's books, embedding any not in the catalog."""
    vectors, weights, kept, to_embed = [], [], [], []
    for book in books:
        index = catalog.find(book)
        if index is not None:
            vectors.append(catalog.vectors[index])
            weights.append(rating_weight(book))
            kept.append(book)
        elif len(book.get('description') or '') >= 40:
            to_embed.append(book)
    if to_embed:
        texts = [embedding_text({**b, 'categories': b.get('categories') or []}) for b in to_embed]
        embedded = get_sentence_model().encode(texts, batch_size=64, normalize_embeddings=True, show_progress_bar=False)
        for book, vector in zip(to_embed, embedded):
            vectors.append(np.asarray(vector, dtype=np.float32))
            weights.append(rating_weight(book))
            kept.append(book)
    if not vectors:
        return np.zeros((0, catalog.vectors.shape[1]), dtype=np.float32), np.zeros(0), []
    return np.vstack(vectors), np.array(weights, dtype=np.float32), kept


def taste_clusters(vectors, weights):
    """Centroids of the books the reader liked, with each cluster's total weight."""
    liked = weights > 0.1
    X, w = vectors[liked], weights[liked]
    if len(X) == 0:
        return np.zeros((0, vectors.shape[1]), dtype=np.float32), np.zeros(0)
    k = 1 if len(X) < 6 else min(MAX_TASTE_CLUSTERS, max(1, round(math.sqrt(len(X) / 2))))
    if k == 1:
        centroids, labels = [np.average(X, axis=0, weights=w)], np.zeros(len(X), dtype=int)
    else:
        from sklearn.cluster import KMeans
        kmeans = KMeans(n_clusters=k, n_init=5, random_state=0).fit(X, sample_weight=w)
        centroids, labels = kmeans.cluster_centers_, kmeans.labels_
    centroids = np.asarray(centroids, dtype=np.float32)
    centroids /= np.linalg.norm(centroids, axis=1, keepdims=True) + 1e-9
    cluster_weights = np.array([w[labels == c].sum() for c in range(len(centroids))])
    return centroids, cluster_weights


def same_author(catalog, books):
    """1 for catalog books by an author of any of `books`, else 0."""
    names = set()
    for book in books:
        authors = book.get('authors') or []
        names |= {a.lower() for a in ([authors] if isinstance(authors, str) else authors)}
    return np.array([1.0 if a & names else 0.0 for a in catalog.authors], dtype=np.float32)


def rarely_reads_childrens_books(catalog, books):
    """True unless children's books are at least a fifth of the reader's books."""
    found = [i for i in (catalog.find(b) for b in books) if i is not None]
    return not found or sum(catalog.for_children[i] for i in found) / len(found) < 0.2


def owned_mask(catalog, owned_vectors, owned_books):
    """Catalog books the reader already has, including other editions."""
    mask = np.zeros(len(catalog.books), dtype=bool)
    for book in owned_books:
        index = catalog.find(book)
        if index is not None:
            mask[index] = True
    if len(owned_vectors):
        mask |= (catalog.vectors @ owned_vectors.T).max(axis=1) > NEAR_DUPLICATE_SIMILARITY
    # Editions with longer titles, e.g. "Pride and Prejudice by Jane Austen" or
    # "Travels with Charley in Search of America" for "Travels with Charley"
    # An identical title counts even if the author is written differently ("J.D." vs "Jerome David")
    owned_titles = {base_title(book.get('title')) for book in owned_books} - {''}
    owned_by_author = {}
    for book in owned_books:
        authors = book.get('authors') or []
        for author in ([authors] if isinstance(authors, str) else authors):
            owned_by_author.setdefault(author.lower(), []).append(base_title(book.get('title')))
    for index, authors in enumerate(catalog.authors):
        titles = [t for a in authors for t in owned_by_author.get(a, []) if t]
        candidate = catalog.base_titles[index]
        if candidate in owned_titles or any(candidate.startswith(t) or t.startswith(candidate) for t in titles):
            mask[index] = True
    return mask


def diverse_pick(catalog, candidates, scores, count, chosen=None, max_per_genre=None, max_per_author=None):
    """Maximal marginal relevance: good matches that aren't near-copies of each other."""
    max_per_author = max_per_author or MAX_PER_AUTHOR
    chosen = list(chosen or [])
    genre_counts, author_counts = {}, {}
    for index in chosen:
        genre_counts[catalog.genre[index]] = genre_counts.get(catalog.genre[index], 0) + 1
        for author in catalog.authors[index]:
            author_counts[author] = author_counts.get(author, 0) + 1
    pool = list(candidates)
    picked = []
    while pool and len(picked) < count:
        if chosen:
            redundancy = (catalog.vectors[pool] @ catalog.vectors[chosen].T).max(axis=1)
        else:
            redundancy = np.zeros(len(pool))
        mmr = DIVERSITY_LAMBDA * scores[pool] - (1 - DIVERSITY_LAMBDA) * redundancy
        for position in np.argsort(-mmr):
            index = pool[position]
            genre = catalog.genre[index]
            if max_per_genre and genre_counts.get(genre, 0) >= max_per_genre:
                continue
            if any(author_counts.get(a, 0) >= max_per_author for a in catalog.authors[index]):
                continue
            picked.append(index)
            chosen.append(index)
            genre_counts[genre] = genre_counts.get(genre, 0) + 1
            for author in catalog.authors[index]:
                author_counts[author] = author_counts.get(author, 0) + 1
            pool.remove(index)
            break
        else:
            break  # every remaining candidate is in a full genre or by a full author
    return picked


def to_result(catalog, index, score, related_to='', isbn_as_list=True):
    doc = catalog.books[index]
    isbn = doc.get('isbn')
    return {
        'title': doc.get('title'),
        'authors': doc.get('authors') or [],
        'categories': doc.get('categories') or [],
        'description': doc.get('description') or '',
        'thumbnail': doc.get('thumbnail'),
        'isbn': ([isbn] if isbn else []) if isbn_as_list else isbn,
        'score': round(float(score) * 100, 1),
        'related_to': related_to,
        'is_bestseller': bool(doc.get('bestsellerWeeks')),
    }


def popular_fallback(catalog, exclude, count):
    """For readers with no books (or no liked books) yet: popular, varied picks."""
    order = [i for i in np.argsort(-catalog.popularity)[:300] if not exclude[i] and catalog.recommendable[i]]
    picked = diverse_pick(catalog, order, catalog.popularity, count, max_per_genre=2)
    return [to_result(catalog, i, catalog.popularity[i]) for i in picked]


# ---------- public API ----------

def recommend(library, exclude_books=(), count=15, username=None, seed=None):
    """A varied, labeled mix of 3-4 recommendation categories (see wheel.py)."""
    import wheel
    return wheel.spin(library, exclude_books, username=username, count=count, seed=seed)


def best_matches(library, exclude_books=(), count=15):
    """The single closest-to-taste ranking, used by evaluate_recs.py to measure accuracy."""
    catalog = get_catalog()
    if len(catalog.books) == 0:
        return []
    vectors, weights, books = reader_vectors(catalog, library)
    extra_vectors, _, extra_books = reader_vectors(catalog, list(exclude_books))
    all_vectors = np.vstack([vectors, extra_vectors]) if len(extra_vectors) else vectors
    exclude = owned_mask(catalog, all_vectors, books + extra_books) | ~catalog.recommendable

    centroids, cluster_weights = taste_clusters(vectors, weights)
    if len(centroids) == 0:
        return popular_fallback(catalog, exclude, count)

    cluster_similarity = catalog.vectors @ centroids.T  # (books, clusters)
    # Closeness to the reader's nearest liked books, which a cluster average can blur
    liked = weights > 0.1
    weighted_similarity = (catalog.vectors @ vectors[liked].T) * weights[liked]
    nearest = min(NEAREST_LIKED, weighted_similarity.shape[1])
    nearest_liked = np.sort(weighted_similarity, axis=1)[:, -nearest:].mean(axis=1)
    author_boost = SAME_AUTHOR_BOOST * same_author(catalog, [b for b, keep in zip(books, liked) if keep])
    disliked = weights < -0.1
    penalty = np.zeros(len(catalog.books), dtype=np.float32)
    if disliked.any():
        dislike_centroid = np.average(vectors[disliked], axis=0, weights=-weights[disliked])
        dislike_centroid /= np.linalg.norm(dislike_centroid) + 1e-9
        penalty = NEGATIVE_PENALTY * np.clip(catalog.vectors @ dislike_centroid, 0, None)

    # Give each taste cluster a share of the slots in proportion to how much the reader likes it
    shares = cluster_weights / cluster_weights.sum()
    slots = np.maximum(1, np.floor(shares * count)).astype(int)
    while slots.sum() < count:
        slots[np.argmax(shares * count - slots)] += 1

    chosen, scores_used = [], {}
    for cluster in np.argsort(-shares):
        scores = (0.5 * cluster_similarity[:, cluster] + 0.5 * nearest_liked - penalty
                  + POPULARITY_BOOST * catalog.popularity + author_boost)
        scores[exclude] = -np.inf
        scores[chosen] = -np.inf
        candidates = [i for i in np.argsort(-scores)[:200] if np.isfinite(scores[i])]
        picked = diverse_pick(catalog, candidates, scores, slots[cluster], chosen=chosen)
        chosen += picked
        for index in picked:
            scores_used[index] = cluster_similarity[index, cluster]
    chosen = chosen[:count]

    # "Because you liked X": the liked book each pick is closest to
    liked_books = [b for b, keep in zip(books, liked) if keep]
    liked_vectors, liked_titles = vectors[liked], [b.get('title') for b in liked_books]
    liked_weights = weights[liked]
    results = []
    for index in chosen:
        # Picked for its author? Name the reader's favorite book by that author
        by_same_author = [i for i, b in enumerate(liked_books)
                          if catalog.authors[index] & {a.lower() for a in (b.get('authors') if isinstance(b.get('authors'), list) else [b.get('authors') or ''])}]
        if by_same_author:
            related = liked_titles[max(by_same_author, key=lambda i: liked_weights[i])]
        else:
            similarity_to_liked = liked_vectors @ catalog.vectors[index]
            related = liked_titles[int(np.argmax(similarity_to_liked))] if len(liked_titles) else ''
        results.append(to_result(catalog, index, scores_used[index], related_to=related))
    return results


def opposite(library, exclude_books=(), count=15):
    catalog = get_catalog()
    if len(catalog.books) == 0:
        return []
    vectors, _, books = reader_vectors(catalog, list(library) + list(exclude_books))
    exclude = owned_mask(catalog, vectors, books) | ~catalog.recommendable
    # "Far from your taste" shouldn't mean picture books for adults who rarely read children's books
    if rarely_reads_childrens_books(catalog, books):
        exclude |= catalog.for_children
    if len(vectors) == 0:
        return popular_fallback(catalog, exclude, count)

    # How close each book is to anything the reader has read; opposite = far from all of it
    closeness = (catalog.vectors @ vectors.T).max(axis=1)
    # Only well-regarded books, so "unfamiliar" doesn't mean "obscure"
    well_regarded = catalog.popularity >= np.quantile(catalog.popularity, 0.7)
    scores = -closeness + 0.15 * catalog.popularity
    scores[exclude | ~well_regarded] = -np.inf
    candidates = [i for i in np.argsort(-scores)[:300] if np.isfinite(scores[i])]
    picked = diverse_pick(catalog, candidates, scores, count, max_per_genre=2)
    return [to_result(catalog, i, 1 - closeness[i]) for i in picked]


def similar(book, count=7):
    """Books like `book` (a dict with at least title/authors/description, or an ISBN in the catalog)."""
    catalog = get_catalog()
    if len(catalog.books) == 0:
        return []
    index = catalog.find(book)
    if index is not None:
        # Use the catalog's title and authors so other editions get excluded too
        book = {**catalog.books[index], **book}
    vectors, _, books = reader_vectors(catalog, [book])
    if len(vectors) == 0:
        return []
    exclude = owned_mask(catalog, vectors, books) | ~catalog.recommendable
    scores = (catalog.vectors @ vectors[0] + POPULARITY_BOOST * catalog.popularity
              + (SAME_AUTHOR_BOOST / 2) * same_author(catalog, books))
    scores[exclude] = -np.inf
    candidates = [i for i in np.argsort(-scores)[:100] if np.isfinite(scores[i])]
    picked = diverse_pick(catalog, candidates, scores, count)
    return [to_result(catalog, i, float(catalog.vectors[i] @ vectors[0]), isbn_as_list=False) for i in picked]


def book_for_isbn(isbn):
    """Details for a book page's ISBN: the catalog, then stored data, then Google/OpenLibrary."""
    import os
    import requests

    if isbn in get_catalog().index_by_isbn:
        return {'isbn': isbn}
    db = get_db()
    metadata = db.bookmetadatas.find_one({'isbn': isbn})
    if metadata and metadata.get('description'):
        return {'isbn': isbn, 'title': metadata.get('title'), 'authors': metadata.get('authors'),
                'categories': metadata.get('categories'), 'description': metadata.get('description')}
    library = db.userlibraries.find_one({'books.isbn': isbn}, {'books.$': 1})
    if library and library.get('books') and library['books'][0].get('description'):
        return library['books'][0]

    try:
        response = requests.get('https://www.googleapis.com/books/v1/volumes', params={
            'q': f'isbn:{isbn}', 'maxResults': 1, 'key': os.getenv('API_KEY')}, timeout=10)
        items = response.json().get('items') if response.ok else None
        if items:
            info = items[0]['volumeInfo']
            return {'isbn': isbn, 'title': info.get('title'), 'authors': info.get('authors', []),
                    'categories': info.get('categories', []), 'description': info.get('description', '')}
        # Quota used up or not found: OpenLibrary has less text, but enough to search with
        response = requests.get('https://openlibrary.org/search.json', params={
            'isbn': isbn, 'fields': 'title,author_name,subject,first_sentence', 'limit': 1}, timeout=10)
        docs = response.json().get('docs') if response.ok else None
        if docs:
            doc = docs[0]
            first_sentence = doc.get('first_sentence')
            first_sentence = first_sentence[0] if isinstance(first_sentence, list) else first_sentence or ''
            subjects = doc.get('subject') or []
            return {'isbn': isbn, 'title': doc.get('title'), 'authors': doc.get('author_name', []),
                    'categories': subjects[:5],
                    'description': ' '.join([first_sentence, 'Subjects: ' + ', '.join(subjects[:15])]).strip()}
    except requests.RequestException:
        pass
    return None
