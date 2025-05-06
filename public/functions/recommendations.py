import sys
import json
import random
import asyncio
import aiohttp
from sentence_transformers import SentenceTransformer, util
from collections import defaultdict
import os
from dotenv import load_dotenv
import numpy as np
from functools import lru_cache
import torch
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
# Define the Google Books API URL
GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
NYT_API_URL = "https://api.nytimes.com/svc/books/v3"
OPENLIBRARY_API_URL = "https://openlibrary.org/api"
API_KEY = os.getenv("API_KEY")
NYT_API_KEY = os.getenv("NYT_API_KEY")

# Load the pre-trained sentence transformer model
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')
model.eval()  # Set to evaluation mode for faster inference
if torch.cuda.is_available():
    model = model.cuda()

# Cache for embeddings
embedding_cache = {}

@lru_cache(maxsize=1000)
def get_embedding(text):
    """Get cached embedding for text"""
    if not text:
        return None
    if text in embedding_cache:
        return embedding_cache[text]
    with torch.no_grad():
        embedding = model.encode(text, convert_to_tensor=True)
        embedding_cache[text] = embedding
        return embedding

def clean_genre(genre):
    """Clean and standardize genre names"""
    if not genre:
        return None
    # Remove common prefixes and clean up
    genre = genre.replace('Fiction', '').replace('Non-Fiction', '').strip()
    # Remove any special characters and extra spaces
    genre = ''.join(c for c in genre if c.isalnum() or c.isspace()).strip()
    return genre if genre else None

async def fetch_book_info(session, genre, start_index, backoff=1):
    """Fetch books from Google Books API with enhanced parameters"""
    cleaned_genre = clean_genre(genre)
    if not cleaned_genre:
        return []
        
    params = {
        'q': f'subject:{cleaned_genre}',
        'maxResults': 40,
        'startIndex': start_index,
        'key': API_KEY,
        'orderBy': 'relevance',
        'printType': 'books',
        'langRestrict': 'en'
    }
    
    try:
        async with session.get(GOOGLE_BOOKS_API_URL, params=params) as response:
            if response.status == 200:
                data = await response.json()
                return data.get('items', [])
            elif response.status == 429:
                await asyncio.sleep(backoff)
                return await fetch_book_info(session, genre, start_index, backoff * 2)
    except Exception as e:
        logger.error(f"Google Books API error: {e}")
    return []

async def fetch_nyt_bestsellers(session):
    """Fetch current NYT bestsellers with error handling"""
    lists = ['hardcover-fiction', 'hardcover-nonfiction', 'young-adult']
    tasks = []
    
    for list_name in lists:
        url = f"{NYT_API_URL}/lists/current/{list_name}.json?api-key={NYT_API_KEY}"
        tasks.append(session.get(url))
    
    bestsellers = []
    responses = await asyncio.gather(*tasks, return_exceptions=True)
    
    for response in responses:
        if isinstance(response, Exception):
            continue
        try:
            if response.status == 200:
                data = await response.json()
                if 'results' in data and 'books' in data['results']:
                    bestsellers.extend(data['results']['books'])
        except Exception as e:
            logger.error(f"NYT API error: {e}")
    
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
    """Fetch books from multiple sources with parallel processing"""
    books = []
    genre_list = [clean_genre(g) for g in genres if clean_genre(g)]
    if not genre_list:
        genre_list = ['Fiction']  # Default genre if none are valid
    
    random.shuffle(genre_list)
    genre_list = genre_list[:3]  # Limit to top 3 genres
    
    logger.info(f"Fetching books for genres: {genre_list}")
    
    async with aiohttp.ClientSession() as session:
        # Fetch NYT bestsellers and Google Books in parallel
        nyt_task = fetch_nyt_bestsellers(session)
        google_tasks = [fetch_book_info(session, genre, random.randint(0, 100)) for genre in genre_list]
        
        # Gather all results
        results = await asyncio.gather(nyt_task, *google_tasks)
        nyt_bestsellers = results[0]
        google_results = results[1:]
        
        # Process Google Books results
        for items in google_results:
            for item in items:
                volume_info = item.get('volumeInfo', {})
                
                if not volume_info.get('title') or not volume_info.get('authors'):
                    continue
                
                thumbnail = volume_info.get('imageLinks', {}).get('thumbnail')
                if thumbnail and 'books.google.com' in thumbnail and '150x150' in thumbnail:
                    continue
                
                isbns = [identifier['identifier'] for identifier in volume_info.get('industryIdentifiers', [])]
                
                book_data = {
                    'title': volume_info.get('title'),
                    'authors': volume_info.get('authors', []),
                    'categories': [clean_genre(cat) for cat in volume_info.get('categories', []) if clean_genre(cat)],
                    'description': volume_info.get('description', ''),
                    'thumbnail': thumbnail,
                    'isbn': isbns,
                    'score': 0,
                    'related_to': '',
                    'is_bestseller': False
                }
                
                books.append(book_data)
        
        # Add NYT bestsellers
        for bestseller in nyt_bestsellers:
            if bestseller.get('title') and bestseller.get('author'):
                books.append({
                    'title': bestseller['title'],
                    'authors': [bestseller['author']],
                    'categories': [],
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

def calculate_similarity_batch(book1, potential_books):
    """Calculate similarities between one book and multiple potential books in batch"""
    if not book1:
        return []
    
    similarities = []
    book1_categories = set(book1.get('categories', []))
    book1_desc_embedding = get_embedding(book1.get('description', ''))
    
    for book2 in potential_books:
        if not book2:
            similarities.append(0)
            continue
        
        # Category similarity
        book2_categories = set(book2.get('categories', []))
        category_similarity = 0
        if book1_categories and book2_categories:
            category_similarity = len(book1_categories.intersection(book2_categories)) / len(book1_categories.union(book2_categories))
        
        # Description similarity
        description_similarity = 0
        if book1_desc_embedding is not None:
            book2_desc_embedding = get_embedding(book2.get('description', ''))
            if book2_desc_embedding is not None:
                description_similarity = util.pytorch_cos_sim(book1_desc_embedding, book2_desc_embedding).item()
        
        # Bestseller bonus
        bestseller_bonus = 0.1 if book2.get('is_bestseller') else 0
        
        final_score = (category_similarity * 0.7 + description_similarity * 0.3 + bestseller_bonus) * 100
        similarities.append(final_score)
    
    return similarities

async def find_best_matches(library, total_recommendations=15):
    """Find best book matches with optimized processing"""
    try:
        # Get unique genres
        user_genres = set()
        for book in library:
            if book.get('categories'):
                user_genres.update(book['categories'])
        
        if not user_genres:
            user_genres = {'Fiction'}
        
        logger.info(f"User genres: {user_genres}")
        
        # Fetch potential matches
        potential_matches = await fetch_books_by_genres(user_genres)
        
        if not potential_matches:
            logger.warning("No potential matches found")
            return []
        
        # Pre-compute embeddings for library books
        for book in library:
            if book.get('description'):
                get_embedding(book['description'])
        
        recommendations = []
        seen_titles = set()
        
        # Process books in batches
        batch_size = 5
        for i in range(0, len(library), batch_size):
            batch = library[i:i + batch_size]
            
            for user_book in batch:
                if len(recommendations) >= total_recommendations:
                    break
                    
                # Calculate similarities for all potential matches at once
                similarities = calculate_similarity_batch(user_book, potential_matches)
                
                if not similarities:
                    continue
                
                # Get top matches
                top_indices = np.argsort(similarities)[-3:][::-1]  # Get top 3 indices
                
                for idx in top_indices:
                    book = potential_matches[idx]
                    if book['title'] not in seen_titles and len(recommendations) < total_recommendations:
                        book['score'] = similarities[idx]
                        book['related_to'] = user_book['title']
                        recommendations.append(book)
                        seen_titles.add(book['title'])
        
        # Fill remaining slots if needed
        remaining_slots = total_recommendations - len(recommendations)
        if remaining_slots > 0:
            for book in potential_matches:
                if book['title'] not in seen_titles and len(recommendations) < total_recommendations:
                    book['score'] = 50
                    recommendations.append(book)
                    seen_titles.add(book['title'])
        
        return recommendations[:total_recommendations]
    except Exception as e:
        logger.error(f"Error in find_best_matches: {e}")
        return []

if __name__ == "__main__":
    try:
        library = json.loads(sys.argv[1])
        recommendations = asyncio.run(find_best_matches(library))
        print(json.dumps(recommendations))
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        print(json.dumps([]))  # Return empty list on error
