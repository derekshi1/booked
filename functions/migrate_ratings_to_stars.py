"""One-time migration: user ratings from 0-100 to 0.5-5 stars (half-star steps).

Converts library books (userlibraries.books.rating) and the Review collection.
Only values above 5 are converted, and the run is recorded in `migrations`, so
it can't double-convert. Original values are backed up to ~/booked-backups/
(outside the repo, since it's user data) before anything changes.

    python migrate_ratings_to_stars.py           # dry run: show what would change
    python migrate_ratings_to_stars.py --apply   # back up, then convert
"""
import argparse
import collections
import datetime
import json
import os

from bson import json_util
from pymongo import UpdateOne

from catalog import get_db

MIGRATION_ID = 'ratings-0-100-to-5-stars'


def to_stars(rating):
    """88 -> 4.5, 50 -> 2.5, 100 -> 5, 11 -> 0.5 (nearest half star, at least half a star)."""
    return min(5.0, max(0.5, round(rating / 20 * 2) / 2))


def needs_conversion(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value > 5


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='back up and convert (default is a dry run)')
    args = parser.parse_args()
    db = get_db()

    done = db.migrations.find_one({'_id': MIGRATION_ID})
    if done:
        print(f"Already applied on {done['appliedAt']:%Y-%m-%d %H:%M} UTC; nothing to do.")
        return

    library_updates, review_updates, backup = [], [], {'userlibraries': [], 'reviews': []}
    mapping = collections.Counter()
    for library in db.userlibraries.find({}, {'username': 1, 'books': 1}):
        for book in library.get('books') or []:
            if isinstance(book, dict) and needs_conversion(book.get('rating')):
                stars = to_stars(book['rating'])
                mapping[(book['rating'], stars)] += 1
                backup['userlibraries'].append({'libraryId': library['_id'], 'username': library['username'],
                                                'bookId': book.get('_id'), 'isbn': book.get('isbn'),
                                                'title': book.get('title'), 'rating': book['rating']})
                # Match the book by its own _id (or ISBN for old entries without one)
                selector = {'books._id': book['_id']} if book.get('_id') else {'books.isbn': book.get('isbn')}
                library_updates.append(UpdateOne({'_id': library['_id'], **selector},
                                                 {'$set': {'books.$.rating': stars}}))
    for review in db.reviews.find({'rating': {'$gt': 5}}, {'username': 1, 'isbn': 1, 'rating': 1}):
        if needs_conversion(review['rating']):
            backup['reviews'].append({'reviewId': review['_id'], 'username': review['username'],
                                      'isbn': review.get('isbn'), 'rating': review['rating']})
            review_updates.append(UpdateOne({'_id': review['_id']}, {'$set': {'rating': to_stars(review['rating'])}}))

    print(f'Library book ratings to convert: {len(library_updates)}; review ratings: {len(review_updates)}')
    by_stars = collections.Counter()
    for (_, stars), n in mapping.items():
        by_stars[stars] += n
    print('Resulting stars (library books):', ', '.join(f'{s:g}★ x{n}' for s, n in sorted(by_stars.items())))
    print('Examples:', ', '.join(f'{old}->{new:g}' for (old, new), _ in sorted(mapping.items())[:: max(1, len(mapping) // 8)]))
    if not args.apply:
        print('Dry run only; rerun with --apply to back up and convert.')
        return

    backup_dir = os.path.expanduser('~/booked-backups')
    os.makedirs(backup_dir, exist_ok=True)
    backup_path = os.path.join(backup_dir, f'ratings-before-stars-{datetime.datetime.now():%Y%m%d-%H%M%S}.json')
    with open(backup_path, 'w') as f:
        f.write(json_util.dumps(backup, indent=1))
    os.chmod(backup_path, 0o600)
    print(f'Backed up {len(backup["userlibraries"])} + {len(backup["reviews"])} original ratings to {backup_path}')

    if library_updates:
        db.userlibraries.bulk_write(library_updates, ordered=False)
    if review_updates:
        db.reviews.bulk_write(review_updates, ordered=False)

    left = (sum(1 for lib in db.userlibraries.find({}, {'books.rating': 1})
                for b in lib.get('books') or [] if isinstance(b, dict) and needs_conversion(b.get('rating')))
            + db.reviews.count_documents({'rating': {'$gt': 5}}))
    db.migrations.insert_one({'_id': MIGRATION_ID, 'appliedAt': datetime.datetime.utcnow(),
                              'libraryRatings': len(library_updates), 'reviewRatings': len(review_updates),
                              'backup': backup_path, 'remainingAbove5': left})
    print(f'Converted. Ratings still above 5: {left}')


if __name__ == '__main__':
    main()
