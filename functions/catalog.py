"""Book catalog for recommendations.

Recommendations used to fetch ~100 random books from Google on every request and
embed them on the spot. Instead, this module keeps a catalog of books in MongoDB
(`catalogbooks`), each embedded once with the sentence model, so a recommendation
is just a vector search over data that's already computed (see recommender.py).

Sources:
  - every book in a Booked user's library, reading list, or currently-reading list
  - NYT bestseller lists (current week, optionally past weeks)
  - Google Books by subject, a fixed number of queries per refresh; a cursor in
    `catalogstate` makes each refresh continue where the last one stopped

Editions of the same book are merged under one key (normalized title + first author).

Usage:
    python catalog.py --google 250 --nyt-weeks 26   # initial build
    python catalog.py                               # nightly-sized refresh
"""
import argparse
import datetime
import hashlib
import os
import re
import string
import sys
import time

import numpy as np
import requests
from dotenv import load_dotenv
from pymongo import MongoClient, UpdateOne

from models import SENTENCE_MODEL_NAME, get_sentence_model

load_dotenv()

CATALOG_COLLECTION = 'catalogbooks'
STATE_COLLECTION = 'catalogstate'
REQUEST_TIMEOUT = 15  # seconds
NYT_REQUEST_SPACING = 13  # seconds; NYT allows ~5 requests per minute
MIN_DESCRIPTION_LENGTH = 60
MAX_GOOGLE_START_INDEX = 400

# Broad English-language subjects; each refresh walks a few pages deeper
GOOGLE_SUBJECTS = [
    'fantasy', 'science fiction', 'mystery', 'thriller', 'romance', 'historical fiction',
    'horror', 'literary fiction', 'young adult fiction', 'juvenile fiction', 'graphic novels',
    'humor', 'poetry', 'drama', 'short stories', 'dystopian', 'adventure', 'crime', 'suspense',
    'contemporary fiction', 'classics', 'magical realism', 'paranormal', 'war fiction',
    'westerns', 'family saga', 'biography', 'memoir', 'history', 'philosophy', 'psychology',
    'self-help', 'business', 'economics', 'popular science', 'physics', 'biology',
    'mathematics', 'technology', 'computers', 'politics', 'sociology', 'true crime', 'travel',
    'cooking', 'health', 'religion', 'spirituality', 'art', 'music', 'nature', 'environment',
    'education', 'parenting', 'sports', 'essays', 'journalism', 'law', 'medicine',
    'anthropology', 'astronomy', 'film', 'mythology', 'space opera', 'cozy mystery',
]


class QuotaExceeded(Exception):
    pass


def get_db():
    client = MongoClient(os.getenv('MONGODB_URI'))
    # The app's connection string has no database name; Mongoose uses "test"
    return client.get_default_database('test')


def _normalize(text):
    return re.sub(r'[^a-z0-9]+', ' ', (text or '').lower()).strip()


def book_key(title, authors):
    """One key per work, so different editions (and ISBNs) of a book merge."""
    base_title = re.split(r'[:(]', title or '')[0]
    author = authors[0] if authors else ''
    return f"{_normalize(base_title)}|{_normalize(author)}"


def _as_list(value):
    if not value:
        return []
    if isinstance(value, list):
        return [v for v in value if v]
    return [v.strip() for v in str(value).split(',') if v.strip()]


def _https(url):
    return url.replace('http://', 'https://', 1) if url else url


def embedding_text(doc):
    parts = [doc.get('title') or '']
    categories = doc.get('categories') or []
    if categories:
        parts.append('; '.join(categories[:4]))
    parts.append(doc.get('description') or '')
    return '. '.join(p for p in parts if p)[:1500]


# ---------- sources ----------

def library_books(db):
    """Books in users' libraries, reading lists and currently-reading lists."""
    records = {}
    for library in db.userlibraries.find({}, {'books': 1, 'readList': 1, 'currentlyReading': 1, 'username': 1}):
        seen_in_this_library = set()
        for field in ('books', 'readList', 'currentlyReading'):
            entries = library.get(field) or []
            if isinstance(entries, dict):
                entries = entries.get('books') or []  # currentlyReading is {books: [...]}
            for book in entries:
                if not isinstance(book, dict):
                    continue
                title = book.get('title')
                if not title:
                    continue
                authors = _as_list(book.get('authors'))
                key = book_key(title, authors)
                record = records.setdefault(key, {
                    'title': title, 'authors': authors, 'categories': _as_list(book.get('categories')),
                    'description': book.get('description') or '', 'thumbnail': _https(book.get('thumbnail')),
                    'isbns': [], 'pageCount': book.get('pageCount'), 'sources': ['library'],
                    'inLibraries': 0, 'userRatings': [],
                })
                if book.get('isbn') and book['isbn'] not in record['isbns']:
                    record['isbns'].append(book['isbn'])
                if len(book.get('description') or '') > len(record['description']):
                    record['description'] = book['description']
                if isinstance(book.get('rating'), (int, float)):
                    record['userRatings'].append(book['rating'])
                if key not in seen_in_this_library:
                    record['inLibraries'] += 1
                    seen_in_this_library.add(key)
    return list(records.values())


def _nyt_get(url, params):
    response = requests.get(url, params={**params, 'api-key': os.getenv('NYT_API_KEY')}, timeout=REQUEST_TIMEOUT)
    if response.status_code == 429:
        raise QuotaExceeded('NYT rate limit')
    response.raise_for_status()
    return response.json()


def nyt_books(weeks_back=0, log=print):
    """Every NYT list for the current week, plus `weeks_back` earlier weeks."""
    records = []
    date = datetime.date.today()
    for week in range(weeks_back + 1):
        if week:
            time.sleep(NYT_REQUEST_SPACING)
        params = {'published_date': date.isoformat()} if week else {}
        try:
            data = _nyt_get('https://api.nytimes.com/svc/books/v3/lists/full-overview.json', params)
        except QuotaExceeded:
            log('NYT rate limited; stopping NYT fetch')
            break
        except requests.RequestException as e:
            log(f'NYT request failed: {e}')
            date -= datetime.timedelta(days=7)
            continue
        for nyt_list in data.get('results', {}).get('lists', []):
            for book in nyt_list.get('books', []):
                title = (book.get('title') or '').strip()
                if not title:
                    continue
                isbns = [i for i in (book.get('primary_isbn13'), book.get('primary_isbn10')) if i and i != 'None']
                records.append({
                    # capwords, unlike str.title(), keeps "Patrick's" rather than "Patrick'S"
                    'title': string.capwords(title.lower()) if title.isupper() else title,
                    'authors': _as_list(book.get('author').replace(' and ', ', ')) if book.get('author') else [],
                    'categories': [nyt_list.get('display_name')] if nyt_list.get('display_name') else [],
                    'description': book.get('description') or '',
                    'thumbnail': _https(book.get('book_image')),
                    'isbns': isbns,
                    'bestsellerWeeks': book.get('weeks_on_list') or 1,
                    'sources': ['nyt'],
                })
        date -= datetime.timedelta(days=7)
    return records


def google_books(subject, start_index):
    response = requests.get('https://www.googleapis.com/books/v1/volumes', params={
        'q': f'subject:"{subject}"', 'maxResults': 40, 'startIndex': start_index, 'orderBy': 'relevance',
        'langRestrict': 'en', 'printType': 'books', 'key': os.getenv('API_KEY'),
    }, timeout=REQUEST_TIMEOUT)
    if response.status_code == 429:
        raise QuotaExceeded('Google Books quota exceeded')
    response.raise_for_status()

    records = []
    for item in response.json().get('items', []):
        info = item.get('volumeInfo', {})
        identifiers = {i.get('type'): i.get('identifier') for i in info.get('industryIdentifiers', [])}
        isbns = [identifiers[t] for t in ('ISBN_13', 'ISBN_10') if identifiers.get(t)]
        thumbnail = info.get('imageLinks', {}).get('thumbnail')
        if not isbns or not thumbnail or info.get('language', 'en') != 'en':
            continue
        records.append({
            'title': info.get('title'), 'authors': info.get('authors', []),
            'categories': info.get('categories', []), 'subjects': [subject],
            'description': info.get('description') or '', 'thumbnail': _https(thumbnail),
            'isbns': isbns, 'publishedDate': info.get('publishedDate'), 'pageCount': info.get('pageCount'),
            'averageRating': info.get('averageRating'), 'ratingsCount': info.get('ratingsCount') or 0,
            'sources': ['google'],
        })
    return records


# ---------- merging and storing ----------

def _union(a, b, limit=None):
    out = list(a or [])
    for item in b or []:
        if item and item not in out:
            out.append(item)
    return out[:limit] if limit else out


def merge(existing, new):
    doc = dict(existing or {})
    for field in ('thumbnail', 'publishedDate', 'pageCount'):
        if not doc.get(field) and new.get(field):
            doc[field] = new[field]
    # NYT titles arrive in capitals; prefer a properly cased title
    if not doc.get('title') or (doc['title'].isupper() and not (new.get('title') or '').isupper()):
        doc['title'] = new.get('title') or doc.get('title')
    if not doc.get('authors'):
        doc['authors'] = new.get('authors') or []
    if len(new.get('description') or '') > len(doc.get('description') or ''):
        doc['description'] = new['description']
    doc['categories'] = _union(doc.get('categories'), new.get('categories'), limit=8)
    doc['subjects'] = _union(doc.get('subjects'), new.get('subjects'), limit=8)
    doc['isbns'] = _union(doc.get('isbns'), new.get('isbns'), limit=20)
    doc['isbn'] = next((i for i in doc['isbns'] if len(i) == 13), doc['isbns'][0] if doc['isbns'] else None)
    if (new.get('ratingsCount') or 0) > (doc.get('ratingsCount') or 0):
        doc['ratingsCount'] = new['ratingsCount']
        doc['averageRating'] = new.get('averageRating')
    doc['bestsellerWeeks'] = max(doc.get('bestsellerWeeks') or 0, new.get('bestsellerWeeks') or 0)
    doc['sources'] = _union(doc.get('sources'), new.get('sources'))
    # Library stats are recomputed from scratch on every refresh, so overwrite them
    if 'inLibraries' in new:
        doc['inLibraries'] = new['inLibraries']
        ratings = new.get('userRatings') or []
        doc['userRatingAvg'] = round(sum(ratings) / len(ratings), 1) if ratings else None
    return doc


def upsert_records(db, records):
    """Merge records into the catalog. Returns how many books were new."""
    grouped = {}
    for record in records:
        if not record.get('title'):
            continue
        key = book_key(record['title'], record.get('authors'))
        grouped[key] = merge(grouped.get(key), record)
    if not grouped:
        return 0

    collection = db[CATALOG_COLLECTION]
    existing = {d['_id']: d for d in collection.find({'_id': {'$in': list(grouped)}}, {'embedding': 0})}
    now = datetime.datetime.utcnow()
    operations = []
    for key, record in grouped.items():
        doc = merge(existing.get(key), record)
        doc.pop('_id', None)
        doc.pop('userRatings', None)
        doc.pop('createdAt', None)  # set once, on insert
        doc['updatedAt'] = now
        operations.append(UpdateOne({'_id': key}, {'$set': doc, '$setOnInsert': {'createdAt': now}}, upsert=True))
    collection.bulk_write(operations, ordered=False)
    return len(set(grouped) - set(existing))


def embed_missing(db, log=print, batch_size=64, deadline=None):
    """Embed books that have no embedding yet, or whose text changed since.

    Stops at `deadline` (a time.monotonic() value); the rest get embedded next time.
    Returns (embedded, still_pending).
    """
    collection = db[CATALOG_COLLECTION]
    pending = []
    for doc in collection.find({}, {'title': 1, 'categories': 1, 'description': 1, 'embeddingTextHash': 1, 'embeddingModel': 1}):
        if len(doc.get('description') or '') < MIN_DESCRIPTION_LENGTH:
            continue
        text = embedding_text(doc)
        text_hash = hashlib.md5(text.encode()).hexdigest()
        if doc.get('embeddingTextHash') != text_hash or doc.get('embeddingModel') != SENTENCE_MODEL_NAME:
            pending.append((doc['_id'], text, text_hash))
    if not pending:
        return 0, 0

    log(f'Embedding {len(pending)} books')
    model = get_sentence_model()
    embedded = 0
    for start in range(0, len(pending), batch_size):
        if deadline and time.monotonic() > deadline:
            log(f'Time budget reached; {len(pending) - embedded} books left for the next refresh')
            break
        batch = pending[start:start + batch_size]
        vectors = model.encode([text for _, text, _ in batch], batch_size=64,
                               normalize_embeddings=True, show_progress_bar=False)
        collection.bulk_write([
            UpdateOne({'_id': key}, {'$set': {
                'embedding': np.asarray(vector, dtype=np.float32).tobytes(),
                'embeddingModel': SENTENCE_MODEL_NAME,
                'embeddingTextHash': text_hash,
            }})
            for (key, _, text_hash), vector in zip(batch, vectors)
        ], ordered=False)
        embedded += len(batch)
    return embedded, len(pending) - embedded


def refresh(google_budget=60, nyt_weeks=0, time_budget=None, log=print):
    """Add new books to the catalog and embed them. Safe to run repeatedly.

    With `time_budget` (seconds), fetching stops at 40% of it and embedding at the end;
    whatever is left is picked up by the next refresh.
    """
    started = time.monotonic()
    deadline = started + time_budget if time_budget else None
    fetch_deadline = started + 0.4 * time_budget if time_budget else None
    db = get_db()
    db[CATALOG_COLLECTION].create_index('isbns')
    stats = {'library': 0, 'nyt': 0, 'google': 0, 'googleQueries': 0, 'newBooks': 0}

    books = library_books(db)
    stats['library'] = len(books)
    stats['newBooks'] += upsert_records(db, books)

    books = nyt_books(nyt_weeks, log=log)
    stats['nyt'] = len(books)
    stats['newBooks'] += upsert_records(db, books)

    state = db[STATE_COLLECTION].find_one({'_id': 'google'}) or {'subjectIndex': 0, 'startIndex': 0}
    for _ in range(google_budget):
        if fetch_deadline and time.monotonic() > fetch_deadline:
            break
        subject = GOOGLE_SUBJECTS[state['subjectIndex']]
        try:
            books = google_books(subject, state['startIndex'])
        except QuotaExceeded:
            log('Google Books quota exceeded; stopping Google fetch')
            break
        except requests.RequestException as e:
            log(f'Google request for {subject!r} failed: {e}')
            books = []
        stats['googleQueries'] += 1
        stats['google'] += len(books)
        stats['newBooks'] += upsert_records(db, books)
        # Move to the next subject; after a full pass over subjects, go one page deeper
        state['subjectIndex'] = (state['subjectIndex'] + 1) % len(GOOGLE_SUBJECTS)
        if state['subjectIndex'] == 0:
            state['startIndex'] = (state['startIndex'] + 40) % MAX_GOOGLE_START_INDEX
    db[STATE_COLLECTION].replace_one({'_id': 'google'}, state, upsert=True)

    stats['embedded'], stats['pendingEmbeddings'] = embed_missing(db, log=log, deadline=deadline)
    stats['catalogSize'] = db[CATALOG_COLLECTION].count_documents({'embeddingModel': SENTENCE_MODEL_NAME})
    db[STATE_COLLECTION].update_one({'_id': 'refresh'}, {'$set': {
        'lastRefresh': datetime.datetime.utcnow(), 'stats': stats}}, upsert=True)
    return stats


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--google', type=int, default=60, help='Google Books queries to spend')
    parser.add_argument('--nyt-weeks', type=int, default=0, help='past weeks of NYT lists to include')
    parser.add_argument('--time-budget', type=float, default=None, help='stop after this many seconds')
    args = parser.parse_args()
    print(refresh(google_budget=args.google, nyt_weeks=args.nyt_weeks, time_budget=args.time_budget,
                  log=lambda message: print(message, file=sys.stderr)))
