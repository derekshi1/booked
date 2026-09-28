"""Offline check of recommendation quality on real Booked libraries.

For each reader with enough books in the catalog, hide a quarter of the books
they rated 70+ and see how highly recommend() ranks them, compared with
recommending popular books or random books. Repeated over several random splits
because there are only a handful of readers with enough rated books.

    python evaluate_recs.py
"""
import random
import statistics
import time

import numpy as np

import recommender
from catalog import book_key, get_db

MIN_BOOKS_IN_CATALOG = 5
MIN_LIKED = 2
LIKED_RATING = 70
SPLITS = 5


def trials(catalog):
    libraries = list(get_db().userlibraries.find({}, {'username': 1, 'books': 1}))
    for seed in range(SPLITS):
        rng = random.Random(seed)
        for library in libraries:
            books = [b for b in library.get('books') or [] if isinstance(b, dict) and b.get('title')]
            in_catalog = [b for b in books if catalog.find(b) is not None]
            liked = [b for b in in_catalog
                     if isinstance(b.get('rating'), (int, float)) and b['rating'] >= LIKED_RATING]
            if len(in_catalog) < MIN_BOOKS_IN_CATALOG or len(liked) < MIN_LIKED:
                continue
            hidden = rng.sample(liked, max(1, len(liked) // 4))
            yield library['username'], [b for b in books if b not in hidden], {catalog.find(b) for b in hidden}


def main():
    catalog = recommender.get_catalog(force=True)
    print(f'Catalog: {len(catalog.books)} embedded books')
    recall = {method: {15: [], 50: []} for method in ('recommender', 'popular', 'random')}
    readers, timings = set(), []

    for username, visible, hidden in trials(catalog):
        readers.add(username)
        hidden_keys = {catalog.books[i]['_id'] for i in hidden}
        owned = {catalog.find(b) for b in visible} - {None}
        for k in (15, 50):
            start = time.perf_counter()
            recs = recommender.recommend(visible, count=k)
            timings.append(time.perf_counter() - start)
            found = {book_key(r['title'], r['authors']) for r in recs} & hidden_keys
            recall['recommender'][k].append(len(found) / len(hidden))
            popular = [i for i in np.argsort(-catalog.popularity)
                       if i not in owned and catalog.recommendable[i]][:k]
            recall['popular'][k].append(len(hidden & set(popular)) / len(hidden))
            # Expected recall of k random picks from books the reader doesn't own
            recall['random'][k].append(k / (len(catalog.books) - len(owned)))

    print(f'Readers: {len(readers)}, trials: {len(recall["random"][15])}')
    for k in (15, 50):
        print(f'Recall@{k} (share of hidden liked books recommended in the top {k}): ' +
              '  '.join(f'{method} {statistics.mean(values[k]):.1%}' for method, values in recall.items()))
    print(f'recommend() time: median {statistics.median(timings) * 1000:.0f} ms, max {max(timings) * 1000:.0f} ms')


if __name__ == '__main__':
    main()
