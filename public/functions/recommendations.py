import sys
import json
import random
import asyncio
import aiohttp
from sentence_transformers import SentenceTransformer, util
from collections import defaultdict
import os
from dotenv import load_dotenv

load_dotenv()
# Define the Google Books API URL
GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
NYT_API_URL = "https://api.nytimes.com/svc/books/v3"
OPENLIBRARY_API_URL = "https://openlibrary.org/api"
API_KEY = os.getenv("API_KEY")
NYT_API_KEY = os.getenv("NYT_API_KEY")

# Load the pre-trained sentence transformer model
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

async def fetch_book_info(session, genre, start_index, backoff=1):
    """Fetch books from Google Books API with enhanced parameters"""
    params = {
        'q': f'subject:{genre}',
        'maxResults': 10,
        'startIndex': start_index,
        'key': API_KEY,
        'orderBy': 'relevance',
        'printType': 'books',
        'langRestrict': 'en'
    }
    
    async with session.get(GOOGLE_BOOKS_API_URL, params=params) as response:
        if response.status == 200:
            data = await response.json()
            return data.get('items', [])
        elif response.status == 429:
            await asyncio.sleep(backoff)
            return await fetch_book_info(session, genre, start_index, backoff * 2)
        return []

async def fetch_nyt_bestsellers(session):
    """Fetch current NYT bestsellers"""
    lists = ['hardcover-fiction', 'hardcover-nonfiction', 'young-adult']
    bestsellers = []
    
    for list_name in lists:
        url = f"{NYT_API_URL}/lists/current/{list_name}.json?api-key={NYT_API_KEY}"
        try:
            async with session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    if 'results' in data and 'books' in data['results']:
                        bestsellers.extend(data['results']['books'])
        except Exception as e:
            print(f"NYT API error: {e}", file=sys.stderr)
    
    return bestsellers

async def fetch_openlibrary_details(session, isbn):
    """Fetch additional book details from OpenLibrary"""
    url = f"{OPENLIBRARY_API_URL}/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
    try:
        async with session.get(url) as response:
            if response.status == 200:
                data = await response.json()
                return data.get(f"ISBN:{isbn}", {})
    except Exception as e:
        print(f"OpenLibrary API error: {e}", file=sys.stderr)
    return {}

async def fetch_books_by_genres(genres, max_results=100):
    """Fetch books from multiple sources and combine results"""
    books = []
    genre_list = list(genres)
    random.shuffle(genre_list)
    
    async with aiohttp.ClientSession() as session:
        # Fetch NYT bestsellers first
        bestsellers = await fetch_nyt_bestsellers(session)
        
        # Process Google Books results
        for genre in genre_list:
            start_index = random.randint(0, 100)  # Reduced range for more relevant results
            fetched_books = await fetch_book_info(session, genre, start_index)
            
            for item in fetched_books:
                volume_info = item.get('volumeInfo', {})
                
                # Skip invalid books
                if not volume_info.get('title') or not volume_info.get('authors'):
                    continue
                
                # Skip placeholder thumbnails
                thumbnail = volume_info.get('imageLinks', {}).get('thumbnail')
                if thumbnail and 'books.google.com' in thumbnail and '150x150' in thumbnail:
                    continue
                
                # Get ISBN
                isbns = [identifier['identifier'] for identifier in volume_info.get('industryIdentifiers', [])]
                
                book_data = {
                    'title': volume_info.get('title'),
                    'authors': volume_info.get('authors', []),
                    'categories': volume_info.get('categories', []),
                    'description': volume_info.get('description', ''),
                    'thumbnail': thumbnail,
                    'isbn': isbns,
                    'score': 0,
                    'related_to': '',
                    'is_bestseller': False
                }
                
                books.append(book_data)
        
        # Add NYT bestsellers to the mix
        for bestseller in bestsellers:
            if bestseller.get('title') and bestseller.get('author'):
                books.append({
                    'title': bestseller['title'],
                    'authors': [bestseller['author']],
                    'categories': [],  # Will be filled by OpenLibrary data
                    'thumbnail': bestseller.get('book_image'),
                    'isbn': [bestseller.get('primary_isbn13')] if bestseller.get('primary_isbn13') else [],
                    'score': 0,
                    'related_to': '',
                    'is_bestseller': True
                })
    
    return books[:max_results]

def calculate_description_similarity(desc1, desc2):
    if not desc1 or not desc2:
        return 0
    embeddings1 = model.encode(desc1, convert_to_tensor=True)
    embeddings2 = model.encode(desc2, convert_to_tensor=True)
    similarity = util.pytorch_cos_sim(embeddings1, embeddings2)
    return similarity.item()

def calculate_similarity(book1, book2):
    """Calculate similarity between books based on categories and description"""
    if not book1 or not book2:
        return 0
    
    # Category similarity
    categories1 = set(book1.get('categories', []))
    categories2 = set(book2.get('categories', []))
    
    category_similarity = 0
    if categories1 and categories2:
        category_similarity = len(categories1.intersection(categories2)) / len(categories1.union(categories2))
    
    # Description similarity
    description_similarity = 0
    if book1.get('description') and book2.get('description'):
        description_similarity = calculate_description_similarity(book1['description'], book2['description'])
    
    # Bestseller bonus
    bestseller_bonus = 0.1 if book2.get('is_bestseller') else 0
    
    final_score = (category_similarity * 0.7 + description_similarity * 0.3 + bestseller_bonus) * 100
    return final_score

async def find_best_matches(library, total_recommendations=15):
    """Find best book matches with genre diversity"""
    # Get all unique genres from user's library
    user_genres = set()
    for book in library:
        if book.get('categories'):
            user_genres.update(book['categories'])
    
    if not user_genres:
        user_genres = {'Fiction'}  # Default genre if none found
    
    # Fetch potential matches
    potential_matches = await fetch_books_by_genres(user_genres)
    
    # Calculate similarities and sort by score
    recommendations = []
    seen_titles = set()
    
    for user_book in library:
        book_recommendations = []
        for potential_book in potential_matches:
            if potential_book['title'] not in seen_titles:
                similarity = calculate_similarity(user_book, potential_book)
                book_recommendations.append((potential_book, similarity))
        
        # Sort recommendations for this book
        book_recommendations.sort(key=lambda x: x[1], reverse=True)
        
        # Take top recommendations for this book
        for book, score in book_recommendations[:3]:  # Get top 3 per user book
            if book['title'] not in seen_titles and len(recommendations) < total_recommendations:
                book['score'] = score
                book['related_to'] = user_book['title']
                recommendations.append(book)
                seen_titles.add(book['title'])
    
    # Fill remaining slots if needed
    remaining_slots = total_recommendations - len(recommendations)
    if remaining_slots > 0:
        for book in potential_matches:
            if book['title'] not in seen_titles and len(recommendations) < total_recommendations:
                book['score'] = 50  # Default score for filling remaining slots
                recommendations.append(book)
                seen_titles.add(book['title'])
    
    return recommendations[:total_recommendations]

if __name__ == "__main__":
    try:
        library = json.loads(sys.argv[1])
        recommendations = asyncio.run(find_best_matches(library))
        print(json.dumps(recommendations))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
