"""The recommendation "wheel": each request mixes 3-4 randomly chosen categories.

Pure similarity search keeps suggesting more of the same (often the same
authors). Instead, every spin picks a few of these categories, splits the slots
between them, and labels each book with why it's there:

    close_matches     "Because you liked East of Eden"      (never by an author you've read)
    favorite_authors  "More from John Steinbeck"            (at most 2 books)
    genre_love        "Because you like classics"
    staples           "A classics staple you haven't read"
    friends           "Maya rated this 95/100"
    bridges           "Where your classics and psychology reads meet"
    cross_format      "Nonfiction for fans of The Grapes of Wrath"
    stretch           "A little outside your usual"
    trending          "On the bestseller list now"

At least one of the first three is always included, so every list has some
close picks. Scores get a little random noise, and books shown to the same
reader recently are held back, so each click gives something new.
"""
import collections
import datetime
import random
import re
import threading

import numpy as np

import recommender as R
from catalog import get_db

ANCHOR_CATEGORIES = ['close_matches', 'genre_love', 'favorite_authors']
CATEGORY_WEIGHTS = {
    'close_matches': 1.0, 'genre_love': 1.0, 'favorite_authors': 0.8, 'staples': 0.8,
    'friends': 1.2, 'bridges': 0.5, 'cross_format': 0.6, 'stretch': 0.8, 'trending': 0.6,
}
MAX_SLOTS = {'favorite_authors': 2}
NOISE = 0.03  # size of the random jitter added to scores
RECENTLY_SHOWN_PENALTY = 0.3
RECENTLY_SHOWN_MEMORY = 45  # books per reader, about three spins
TRENDING_DAYS = 21
FRIEND_LOVED_RATING = 80

# Genre words too broad (or just formats) to be interesting in a label
GENERIC_GENRES = re.compile(
    r'^(fiction|general|nonfiction|non-fiction|literary collections|juvenile nonfiction|'
    r'.*(hardcover|paperback|mass market|e-book|audio|combined print).*)$', re.IGNORECASE)
NONFICTION = re.compile(
    r'nonfiction|biography|memoir|\bhistory\b|philosophy|psychology|self-help|business|economics|'
    r'science(?! fiction)|politics|sociology|true crime|travel|cooking|health|religion|essays|'
    r'journalism|law|medicine|anthropology|advice|how-to', re.IGNORECASE)
FICTION = re.compile(
    r'\bfiction\b|novel|fantasy|mystery|thriller|romance|horror|poetry|drama|short stories|'
    r'dystopian|classics|graphic novels|manga', re.IGNORECASE)

_recently_shown = collections.defaultdict(lambda: collections.deque(maxlen=RECENTLY_SHOWN_MEMORY))
_recently_shown_lock = threading.Lock()


def genres_of(doc):
    """Readable genre names for a catalog book: our Google subjects first, then categories."""
    names = list(doc.get('subjects') or [])
    for category in doc.get('categories') or []:
        names.append(category.split('/')[-1].strip())
    return [n.lower() for n in names if n and not GENERIC_GENRES.match(n.strip())]


def book_format(doc):
    text = ' '.join((doc.get('categories') or []) + (doc.get('subjects') or []))
    if re.search(r'nonfiction', text, re.IGNORECASE):
        return 'nonfiction'
    if FICTION.search(text):
        return 'fiction'
    if NONFICTION.search(text):
        return 'nonfiction'
    return None


def as_authors(value):
    return [value] if isinstance(value, str) else list(value or [])


def reason(*parts):
    """Label segments; a (text,) tuple is shown in italics (a title or name)."""
    return [{'text': p[0], 'em': True} if isinstance(p, tuple) else {'text': p, 'em': False} for p in parts]


class Spin:
    """Everything the categories need about one reader and one request."""

    def __init__(self, library, exclude_books, username, rng):
        self.rng = rng
        self.username = username
        self.catalog = c = R.get_catalog()
        self.vectors, self.weights, self.books = R.reader_vectors(c, library)
        extra_vectors, _, extra_books = R.reader_vectors(c, list(exclude_books))
        owned_vectors = np.vstack([self.vectors, extra_vectors]) if len(extra_vectors) else self.vectors
        self.owned_books = self.books + extra_books
        self.exclude = R.owned_mask(c, owned_vectors, self.owned_books) | ~c.recommendable
        if R.rarely_reads_childrens_books(c, self.owned_books):
            self.exclude |= c.for_children

        self.liked = self.weights > 0.1
        self.liked_books = [b for b, keep in zip(self.books, self.liked) if keep]
        self.liked_vectors = self.vectors[self.liked]
        self.centroids, self.cluster_weights = R.taste_clusters(self.vectors, self.weights)
        self.cluster_similarity = c.vectors @ self.centroids.T if len(self.centroids) else np.zeros((len(c.books), 0))
        self.taste = self.cluster_similarity.max(axis=1) if len(self.centroids) else np.zeros(len(c.books))

        disliked = self.weights < -0.1
        self.penalty = np.zeros(len(c.books), dtype=np.float32)
        if disliked.any():
            centroid = np.average(self.vectors[disliked], axis=0, weights=-self.weights[disliked])
            centroid /= np.linalg.norm(centroid) + 1e-9
            self.penalty = R.NEGATIVE_PENALTY * np.clip(c.vectors @ centroid, 0, None)

        self.read_authors = set()
        for book in self.owned_books:
            self.read_authors |= {a.lower() for a in as_authors(book.get('authors'))}
        self.by_read_author = np.array([bool(a & self.read_authors) for a in c.authors])

        with _recently_shown_lock:
            recent = set(_recently_shown[username]) if username else set()
        self.recent = np.array([d['_id'] in recent for d in c.books])
        self.cluster_names = [self.name_cluster(i) for i in range(len(self.centroids))]
        if R.rarely_reads_childrens_books(c, self.owned_books):
            # Children's books are filtered out, so don't build categories around a children's genre
            self.cluster_names = [None if n and R.CHILDREN.search(n) else n for n in self.cluster_names]

    def name_cluster(self, cluster):
        """The most common genre among the reader's books in this cluster (counted double)
        and the catalog books nearest to it."""
        counts = collections.Counter()
        if len(self.liked_vectors):
            members = np.argmax(self.liked_vectors @ self.centroids.T, axis=1) == cluster
            for book, member in zip(self.liked_books, members):
                index = self.catalog.find(book)
                if member and index is not None:
                    for genre in genres_of(self.catalog.books[index])[:2]:
                        counts[genre] += 2
        nearest = np.argsort(-self.cluster_similarity[:, cluster])[:40]
        for index in nearest:
            for genre in genres_of(self.catalog.books[index])[:2]:
                counts[genre] += 1
        return counts.most_common(1)[0][0] if counts else None

    def closest_liked(self, index):
        if not len(self.liked_books):
            return None
        return self.liked_books[int(np.argmax(self.liked_vectors @ self.catalog.vectors[index]))].get('title')

    def pick(self, scores, count, taken, max_per_author=None, pool=80):
        """Top candidates by score, with random jitter, held-back recent books, and variety.
        Randomness only chooses among the best `pool` candidates."""
        scores = scores.astype(np.float64) - RECENTLY_SHOWN_PENALTY * self.recent
        scores[self.exclude] = -np.inf
        if taken:
            scores[list(taken)] = -np.inf
        best = [i for i in np.argsort(-scores)[:pool] if np.isfinite(scores[i])]
        noisy = scores + NOISE * self.rng.gumbel(size=len(scores))
        candidates = sorted(best, key=lambda i: -noisy[i])
        return R.diverse_pick(self.catalog, candidates, noisy, count, chosen=list(taken),
                              max_per_author=max_per_author)


# ---------- categories: each returns [(catalog index or result dict, reason segments)] ----------

def close_matches(spin, count, taken):
    c = spin.catalog
    weighted = (c.vectors @ spin.liked_vectors.T) * spin.weights[spin.liked]
    nearest = np.sort(weighted, axis=1)[:, -min(R.NEAREST_LIKED, weighted.shape[1]):].mean(axis=1)
    scores = 0.5 * spin.taste + 0.5 * nearest - spin.penalty + R.POPULARITY_BOOST * c.popularity
    scores[spin.by_read_author] = -np.inf  # new-to-you authors only
    return [(i, reason('Because you liked ', (spin.closest_liked(i),))) for i in spin.pick(scores, count, taken, pool=40)]


def favorite_authors(spin, count, taken):
    c = spin.catalog
    author_love = collections.Counter()
    for book, weight in zip(spin.books, spin.weights):
        authors = book.get('authors') or []
        for author in as_authors(authors):
            if weight > 0.1:
                author_love[author.lower()] += weight
    scores = np.array([max((author_love.get(a, 0) for a in authors), default=0) for authors in c.authors])
    scores = np.where(scores > 0, scores + spin.taste, -np.inf)
    results = []
    for index in spin.pick(scores, count, taken, max_per_author=1):
        author = next((a for a in c.books[index].get('authors') or [] if a.lower() in author_love), None)
        results.append((index, reason('More from ', (author,))))
    return results


def genre_love(spin, count, taken):
    named = [i for i, name in enumerate(spin.cluster_names) if name]
    if not named:
        return []
    cluster = spin.rng.choice(named, p=spin.cluster_weights[named] / spin.cluster_weights[named].sum())
    genre = spin.cluster_names[cluster]
    c = spin.catalog
    in_genre = np.array([genre in genres_of(d) for d in c.books])
    scores = spin.cluster_similarity[:, cluster] + 0.15 * c.popularity - spin.penalty
    scores[spin.by_read_author | ~in_genre] = -np.inf  # only books actually in that genre
    return [(i, reason('Because you like ', (genre,))) for i in spin.pick(scores, count, taken)]


def staples(spin, count, taken):
    c = spin.catalog
    well_known = (c.popularity >= np.quantile(c.popularity, 0.9))
    close_enough = spin.taste >= np.quantile(spin.taste, 0.8)
    scores = np.where(well_known & close_enough, c.popularity + 0.5 * spin.taste, -np.inf)
    results = []
    for index in spin.pick(scores, count, taken):
        genre = next(iter(genres_of(c.books[index])), None)
        if genre:
            label = reason('A ', (genre,), " staple you haven't read")
        elif c.books[index].get('bestsellerWeeks'):
            label = reason("A bestseller you haven't read")
        else:
            label = reason("A modern staple you haven't read")
        results.append((index, label))
    return results


def friends(spin, count, taken):
    if not spin.username:
        return []
    db = get_db()
    user = db.users.find_one({'username': spin.username}, {'friends': 1})
    friend_names = [u['username'] for u in db.users.find({'_id': {'$in': (user or {}).get('friends') or []}}, {'username': 1})]
    if not friend_names:
        return []
    c = spin.catalog
    owned_titles = {R.base_title(b.get('title')) for b in spin.owned_books}
    loved = {}  # catalog index or title -> (best rating, friend, book)
    for library in db.userlibraries.find({'username': {'$in': friend_names}}, {'username': 1, 'books': 1}):
        for book in library.get('books') or []:
            rating = book.get('rating') if isinstance(book, dict) else None
            if not isinstance(rating, (int, float)) or rating < FRIEND_LOVED_RATING:
                continue
            if R.base_title(book.get('title')) in owned_titles:
                continue
            index = c.find(book)
            key = index if index is not None else R.base_title(book.get('title'))
            if index is not None and (spin.exclude[index] or index in taken):
                continue
            if key not in loved or rating > loved[key][0]:
                loved[key] = (rating, library['username'], book)
    # Favor what fits the reader's taste, with some randomness so the same friend picks rotate
    ranked = sorted(loved.items(), key=lambda kv: -(kv[1][0] / 100
                    + (0.5 * spin.taste[kv[0]] if isinstance(kv[0], (int, np.integer)) else 0)
                    + 0.1 * spin.rng.random()))
    results = []
    for key, (rating, friend, book) in ranked[:count]:
        label = reason((friend,), f' rated this {round(rating)}/100')
        if isinstance(key, (int, np.integer)):
            results.append((int(key), label))
        else:
            results.append(({
                'title': book.get('title'), 'authors': as_authors(book.get('authors')),
                'categories': book.get('categories') or [], 'description': book.get('description') or '',
                'thumbnail': book.get('thumbnail'), 'isbn': [book['isbn']] if book.get('isbn') else [],
                'score': float(rating), 'related_to': '', 'is_bestseller': False,
            }, label))
    return results


def bridges(spin, count, taken):
    named = [(i, n) for i, n in enumerate(spin.cluster_names) if n]
    pairs = [(a, b) for x, (a, na) in enumerate(named) for (b, nb) in named[x + 1:] if na != nb]
    if not pairs:
        return []
    a, b = pairs[spin.rng.integers(len(pairs))]
    scores = np.minimum(spin.cluster_similarity[:, a], spin.cluster_similarity[:, b]) + 0.1 * spin.catalog.popularity
    label = reason('Where your ', (spin.cluster_names[a],), ' and ', (spin.cluster_names[b],), ' reads meet')
    return [(i, label) for i in spin.pick(scores, count, taken)]


def cross_format(spin, count, taken):
    c = spin.catalog
    formats = [book_format(c.books[i]) for i in (c.find(b) for b in spin.liked_books) if i is not None]
    fiction, nonfiction = formats.count('fiction'), formats.count('nonfiction')
    if not fiction and not nonfiction:
        return []
    target = 'nonfiction' if fiction >= nonfiction else 'fiction'
    sources = [(b, w) for b, w in zip(spin.liked_books, spin.weights[spin.liked])
               if (i := c.find(b)) is not None and book_format(c.books[i]) != target]
    if not sources:
        return []
    # Start from one of the reader's favorites, more often the higher rated ones
    weights = np.array([w for _, w in sources]) ** 2
    source = sources[spin.rng.choice(len(sources), p=weights / weights.sum())][0]
    source_vector = c.vectors[c.find(source)]
    is_target = np.array([book_format(d) == target for d in c.books])
    # Only books with some readership (bestseller runs, ratings, Booked readers), not textbooks
    scores = np.where(is_target & (c.popularity > 0), c.vectors @ source_vector + 0.1 * c.popularity, -np.inf)
    label = reason(f'{target.capitalize()} for fans of ', (source.get('title'),))
    return [(i, label) for i in spin.pick(scores, count, taken)]


def stretch(spin, count, taken):
    c = spin.catalog
    # Familiar enough to enjoy, different enough to surprise: the 80th-95th percentile of closeness
    low, high = np.quantile(spin.taste, [0.8, 0.95])
    in_band = (spin.taste >= low) & (spin.taste <= high)
    scores = np.where(in_band & (c.popularity >= np.quantile(c.popularity, 0.6)), c.popularity - spin.penalty, -np.inf)
    return [(i, reason('A little outside your usual')) for i in spin.pick(scores, count, taken)]


def trending(spin, count, taken):
    c = spin.catalog
    cutoff = (datetime.date.today() - datetime.timedelta(days=TRENDING_DAYS)).isoformat()
    recent = np.array([(d.get('nytListDate') or '') >= cutoff for d in c.books])
    scores = np.where(recent, spin.taste + 0.2 * c.popularity, -np.inf)
    return [(i, reason('On the bestseller list now')) for i in spin.pick(scores, count, taken)]


CATEGORIES = {
    'close_matches': close_matches, 'favorite_authors': favorite_authors, 'genre_love': genre_love,
    'staples': staples, 'friends': friends, 'bridges': bridges, 'cross_format': cross_format,
    'stretch': stretch, 'trending': trending,
}


def choose_categories(rng, count):
    """One anchor category (close to the reader's taste), then random others."""
    anchor = rng.choice(ANCHOR_CATEGORIES, p=np.array([CATEGORY_WEIGHTS[c] for c in ANCHOR_CATEGORIES]) /
                        sum(CATEGORY_WEIGHTS[c] for c in ANCHOR_CATEGORIES))
    others = [c for c in CATEGORIES if c != anchor]
    weights = np.array([CATEGORY_WEIGHTS[c] for c in others])
    return [anchor] + list(rng.choice(others, size=count - 1, replace=False, p=weights / weights.sum()))


def spin(library, exclude_books=(), username=None, count=15, seed=None):
    rng = np.random.default_rng(seed)
    s = Spin(library, exclude_books, username, rng)
    if len(s.catalog.books) == 0:
        return []
    if not s.liked.any():
        return R.popular_fallback(s.catalog, s.exclude, count)

    chosen = [str(c) for c in choose_categories(rng, int(rng.choice([3, 4])))]
    # Split the slots evenly, except favorite authors, which get at most 2
    slots = {c: min(MAX_SLOTS[c], count // len(chosen)) for c in chosen if c in MAX_SLOTS}
    flexible = [c for c in chosen if c not in MAX_SLOTS]
    per_category, leftover = divmod(count - sum(slots.values()), len(flexible))
    for c in flexible:
        slots[c] = per_category
    for c in rng.permutation(flexible)[:leftover]:
        slots[str(c)] += 1

    taken, groups = set(), []
    for category in chosen:
        picks = CATEGORIES[category](s, slots[category], taken)
        taken |= {p for p, _ in picks if isinstance(p, (int, np.integer))}
        groups.append((category, picks))
    # Categories that came up short (e.g. no friends with ratings) leave room for close matches
    shortfall = count - sum(len(p) for _, p in groups)
    if shortfall > 0:
        extra = close_matches(s, shortfall, taken) or genre_love(s, shortfall, taken)
        taken |= {p for p, _ in extra if isinstance(p, (int, np.integer))}
        groups.append(('close_matches', extra))

    # Interleave the categories so the row mixes them
    results, queues = [], [collections.deque(p) for _, p in groups]
    names = [c for c, _ in groups]
    while any(queues) and len(results) < count:
        for category, queue in zip(names, queues):
            if queue and len(results) < count:
                pick, label = queue.popleft()
                result = pick if isinstance(pick, dict) else R.to_result(
                    s.catalog, pick, s.taste[pick], related_to=s.closest_liked(pick) or '')
                result.update({'category': category, 'reason': label})
                results.append(result)

    if username:
        with _recently_shown_lock:
            _recently_shown[username].extend(s.catalog.books[p]['_id'] for p in taken)
    return results
