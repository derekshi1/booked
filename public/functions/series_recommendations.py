import requests
import json
from typing import List, Dict, Any
from datetime import datetime, timedelta
import logging
from collections import defaultdict

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# API Keys
NYT_API_KEY = '07KGzNSRt9XlvFc8Esd006b7fqiGA8cc'
GOOGLE_BOOKS_API_KEY = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'

# Series-specific keywords and patterns
SERIES_PATTERNS = [
    'series', 'chronicles', 'saga', 'cycle', 'trilogy', 'quartet', 'pentalogy',
    'book 1', 'book 2', 'book 3', 'book 4', 'book 5', 'book 6', 'book 7', 'book 8',
    'volume 1', 'volume 2', 'volume 3', 'volume 4', 'volume 5', 'volume 6', 'volume 7', 'volume 8',
    'part 1', 'part 2', 'part 3', 'part 4', 'part 5', 'part 6', 'part 7', 'part 8',
    'collection', 'anthology', 'omnibus', 'complete', 'boxed set',
    'first book', 'second book', 'third book', 'fourth book', 'fifth book',
    'first installment', 'second installment', 'third installment',
    'first volume', 'second volume', 'third volume',
    'book one', 'book two', 'book three', 'book four', 'book five',
    'volume one', 'volume two', 'volume three', 'volume four', 'volume five',
    # New patterns
    'novel 1', 'novel 2', 'novel 3',
    'episode 1', 'episode 2', 'episode 3',
    'chapter 1', 'chapter 2', 'chapter 3',
    'first novel', 'second novel', 'third novel',
    'first episode', 'second episode', 'third episode',
    'first chapter', 'second chapter', 'third chapter',
    'series book', 'series novel', 'series volume',
    'first in series', 'second in series', 'third in series',
    'beginning of', 'continuation of', 'conclusion of',
    'first of', 'second of', 'third of',
    'first in the', 'second in the', 'third in the'
]

# Popular series genres
SERIES_GENRES = [
    'fantasy', 'science fiction', 'mystery', 'thriller', 'romance',
    'young adult', 'historical fiction', 'adventure', 'dystopian',
    'urban fantasy', 'epic fantasy', 'space opera', 'paranormal',
    'contemporary fantasy', 'high fantasy', 'dark fantasy',
    'cozy mystery', 'detective', 'crime', 'suspense',
    'historical romance', 'contemporary romance', 'paranormal romance',
    'literary fiction', 'classic', 'contemporary', 'magical realism',
    'supernatural', 'horror', 'gothic', 'steampunk', 'cyberpunk',
    'post-apocalyptic', 'alternate history', 'time travel',
    # New genres
    'middle grade', 'children\'s fiction', 'picture books',
    'graphic novels', 'comics', 'manga', 'light novels',
    'biography', 'memoir', 'autobiography',
    'philosophy', 'religion', 'spirituality',
    'self-help', 'personal development',
    'business', 'economics', 'finance',
    'science', 'technology', 'engineering',
    'mathematics', 'physics', 'chemistry',
    'biology', 'medicine', 'health',
    'cooking', 'food', 'nutrition',
    'travel', 'geography', 'history',
    'politics', 'social sciences',
    'education', 'reference', 'study guides'
]

class SeriesRecommender:
    def __init__(self):
        self.cache = {}
        self.cache_duration = timedelta(hours=24)
        self.last_fetch = None

    def is_series_book(self, title: str, description: str) -> bool:
        """Check if a book is part of a series based on title and description."""
        title_lower = title.lower()
        description_lower = description.lower() if description else ''
        
        # Check for series patterns in title
        for pattern in SERIES_PATTERNS:
            if pattern in title_lower:
                return True
        
        # Check for series indicators in description
        series_indicators = ['first book', 'second book', 'third book', 'fourth book', 'fifth book',
                           'first installment', 'second installment', 'third installment',
                           'first volume', 'second volume', 'third volume']
        
        for indicator in series_indicators:
            if indicator in description_lower:
                return True
        
        return False

    def fetch_nyt_series(self) -> List[Dict[str, Any]]:
        """Fetch series books from NYT API."""
        try:
            response = requests.get(
                f'https://api.nytimes.com/svc/books/v3/lists/current/series-books.json',
                params={'api-key': NYT_API_KEY}
            )
            data = response.json()
            
            if 'results' in data and 'books' in data['results']:
                return [{
                    'title': book['title'],
                    'authors': [book['author']],
                    'thumbnail': book['book_image'],
                    'isbn': book['primary_isbn13'],
                    'description': book.get('description', ''),
                    'popularity': {
                        'isBestseller': True,
                        'weeksOnList': book.get('weeks_on_list', 0),
                        'rank': book.get('rank', 999)
                    },
                    'source': 'nyt'
                } for book in data['results']['books']]
            return []
        except Exception as e:
            logger.error(f"Error fetching NYT series: {str(e)}")
            return []

    def fetch_google_series(self) -> List[Dict[str, Any]]:
        """Fetch series books from Google Books API."""
        all_books = []
        
        # Additional search queries beyond just genres
        additional_queries = [
            'intitle:"book 1"',
            'intitle:"volume 1"',
            'intitle:"part 1"',
            'intitle:"first book"',
            'intitle:"series"',
            'intitle:"chronicles"',
            'intitle:"saga"',
            'intitle:"trilogy"',
            'intitle:"cycle"',
            'subject:"series"',
            'subject:"fiction series"',
            'subject:"book series"',
            # New queries
            'intitle:"novel 1"',
            'intitle:"episode 1"',
            'intitle:"first novel"',
            'intitle:"first episode"',
            'intitle:"series book"',
            'intitle:"first in series"',
            'intitle:"beginning of"',
            'intitle:"first of"',
            'intitle:"first in the"',
            'subject:"novel series"',
            'subject:"episode series"',
            'subject:"chapter series"',
            'subject:"book collection"',
            'subject:"book anthology"',
            'subject:"book omnibus"',
            'subject:"book boxed set"',
            'subject:"book complete"',
            'subject:"book trilogy"',
            'subject:"book quartet"',
            'subject:"book pentalogy"',
            'subject:"book saga"',
            'subject:"book chronicles"',
            'subject:"book cycle"'
        ]
        
        # Combine genre searches with additional queries
        search_queries = [f'subject:"{genre}" series:true' for genre in SERIES_GENRES]
        search_queries.extend(additional_queries)
        
        for query in search_queries:
            try:
                response = requests.get(
                    'https://www.googleapis.com/books/v1/volumes',
                    params={
                        'q': query,
                        'maxResults': 40,
                        'orderBy': 'relevance',
                        'key': GOOGLE_BOOKS_API_KEY,
                        'langRestrict': 'en',  # Restrict to English books
                        'printType': 'books',  # Only include books
                        'filter': 'partial'    # Include books with partial information
                    }
                )
                data = response.json()
                
                if 'items' in data:
                    for book in data['items']:
                        volume_info = book['volumeInfo']
                        if self.is_series_book(volume_info['title'], volume_info.get('description', '')):
                            all_books.append({
                                'title': volume_info['title'],
                                'authors': volume_info.get('authors', ['Unknown Author']),
                                'thumbnail': volume_info.get('imageLinks', {}).get('thumbnail', ''),
                                'isbn': volume_info.get('industryIdentifiers', [{}])[0].get('identifier', ''),
                                'description': volume_info.get('description', ''),
                                'popularity': {
                                    'rating': volume_info.get('averageRating', 0),
                                    'ratingsCount': volume_info.get('ratingsCount', 0),
                                    'isBestseller': False
                                },
                                'source': 'google'
                            })
            except Exception as e:
                logger.error(f"Error fetching Google Books series for query {query}: {str(e)}")
                continue
        
        return all_books

    def fetch_openlibrary_series(self) -> List[Dict[str, Any]]:
        """Fetch series books from OpenLibrary API."""
        all_books = []
        
        for genre in SERIES_GENRES:
            try:
                response = requests.get(f'https://openlibrary.org/subjects/{genre}.json?limit=20')
                data = response.json()
                
                if 'works' in data:
                    for work in data['works']:
                        if self.is_series_book(work['title'], work.get('description', '')):
                            all_books.append({
                                'title': work['title'],
                                'authors': [author['name'] for author in work.get('authors', [])] or ['Unknown Author'],
                                'thumbnail': f"https://covers.openlibrary.org/b/id/{work['cover_id']}-L.jpg" if 'cover_id' in work else '',
                                'isbn': work.get('isbn', ''),
                                'description': work.get('description', ''),
                                'popularity': {
                                    'rating': work.get('rating', {}).get('average', 0),
                                    'ratingsCount': work.get('rating', {}).get('count', 0),
                                    'isBestseller': False
                                },
                                'source': 'openlibrary'
                            })
            except Exception as e:
                logger.error(f"Error fetching OpenLibrary series for genre {genre}: {str(e)}")
                continue
        
        return all_books

    def filter_and_sort_books(self, books: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Filter and sort books based on popularity and quality metrics."""
        # Filter books with more relaxed criteria
        filtered_books = []
        for book in books:
            # Keep NYT bestsellers
            if book['popularity']['isBestseller']:
                filtered_books.append(book)
                continue
            
            # For other sources, more relaxed criteria
            if (book['popularity']['ratingsCount'] >= 10 and  # Reduced from 30
                book['popularity']['rating'] >= 3.0):  # Reduced from 3.5
                filtered_books.append(book)
        
        # Sort books with more balanced scoring
        def get_score(book):
            if book['popularity']['isBestseller']:
                # NYT bestsellers get highest priority
                return (1000 + book['popularity']['weeksOnList'])
            else:
                # Other books scored by rating and number of ratings
                # More balanced scoring to give newer/less rated books a chance
                rating_weight = 0.7
                ratings_count_weight = 0.3
                return (book['popularity']['rating'] * rating_weight + 
                       (1 + book['popularity']['ratingsCount'] / 1000) * ratings_count_weight)
        
        return sorted(filtered_books, key=get_score, reverse=True)

    def get_recommendations(self) -> List[Dict[str, Any]]:
        """Get series book recommendations from all sources."""
        # Check cache
        if self.last_fetch and datetime.now() - self.last_fetch < self.cache_duration:
            return self.cache.get('recommendations', [])
        
        # Fetch from all sources
        nyt_books = self.fetch_nyt_series()
        google_books = self.fetch_google_series()
        openlibrary_books = self.fetch_openlibrary_series()
        
        # Combine all books
        all_books = nyt_books + google_books + openlibrary_books
        
        # Remove duplicates based on ISBN
        unique_books = {}
        for book in all_books:
            if book['isbn'] and book['isbn'] not in unique_books:
                unique_books[book['isbn']] = book
        
        # Filter and sort
        recommendations = self.filter_and_sort_books(list(unique_books.values()))
        
        # Update cache
        self.cache['recommendations'] = recommendations
        self.last_fetch = datetime.now()
        
        return recommendations

def get_series_recommendations():
    """Main function to get series recommendations."""
    try:
        recommender = SeriesRecommender()
        recommendations = recommender.get_recommendations()
        
        return {
            'success': True,
            'books': recommendations
        }
    except Exception as e:
        logger.error(f"Error getting series recommendations: {str(e)}")
        return {
            'success': False,
            'message': str(e)
        }

if __name__ == '__main__':
    # Test the recommendations
    result = get_series_recommendations()
    print(json.dumps(result, indent=2)) 