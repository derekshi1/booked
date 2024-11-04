import asyncio
import aiohttp
import random
import json
import sys
import logging
from sentence_transformers import SentenceTransformer, util
from pymongo import MongoClient
from collections import defaultdict

import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()
API_KEY = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'

mongodb_uri = os.getenv("MONGODB_URI")

client = MongoClient(mongodb_uri)
db = client["test"]  
user_libraries = db["userlibraries"]

# Load sentence transformer model
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

async def fetch_books_by_genre(session, genre, start_index, max_results=10):
    GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
    
    params = {
        'q': f'subject:{genre}',
        'maxResults': max_results,
        'startIndex': start_index,
        'key': API_KEY
    }
    async with session.get(GOOGLE_BOOKS_API_URL, params=params) as response:
        if response.status == 200:
            data = await response.json()
            return data.get('items', [])
        else:
            return []



async def fetch_books_by_genres(genres, max_results=100):
    books = []
    async with aiohttp.ClientSession() as session:
        for genre in genres:
            fetched_books = await fetch_books_by_genre(session, genre, random.randint(0, 500), max_results)
            books.extend(fetched_books)
    return books[:max_results]

def calculate_description_similarity(desc1, desc2):
    if not desc1 or not desc2:
        return 0
    embeddings1 = model.encode(desc1, convert_to_tensor=True)
    embeddings2 = model.encode(desc2, convert_to_tensor=True)
    similarity = util.pytorch_cos_sim(embeddings1, embeddings2)
    return similarity.item()

def calculate_initial_compatibility(book1, book2):
    categories1 = set(book1.get('categories', []))
    categories2 = set(book2.get('categories', []))
    common_categories = categories1.intersection(categories2)
    category_similarity = len(common_categories) / (len(categories1) + len(categories2) + 1e-6)
    
    pub_date_similarity = 0
    try:
        year1 = int(book1.get('publishedDate', '')[:4])
        year2 = int(book2.get('publishedDate', '')[:4])
        pub_date_similarity = 1 - abs(year1 - year2) / max(year1, year2)
    except ValueError:
        pass

    return (0.6 * category_similarity + 0.4 * pub_date_similarity) * 100

def fetch_similar_user_books(library_books):
    # Find users who have any overlapping books in their libraries
    similar_books = []
    for book in library_books:
        matching_users = user_libraries.find({'books': {'$in': [book['title']]}})
        for user in matching_users:
            similar_books.extend(user.get('books', []))
    return similar_books

async def find_best_matches(library, user_id, total_recommendations=25):
    user_library_books = user_libraries.find_one({'username': user_id}).get('books', [])
    similar_user_books = fetch_similar_user_books(user_library_books)
    
    genre_books = defaultdict(list)
    for book in library:
        for genre in book.get('categories', []):
            genre_books[genre].append(book)

    selected_books = random.choices(library, k=total_recommendations // len(library))
    all_genres = set(genre_books.keys())
    potential_matches = await fetch_books_by_genres(all_genres, max_results=total_recommendations * 3)
    
    recommended_titles = set()
    recommendations = []

    for user_book in selected_books:
        potential_books = [book for book in potential_matches if book['title'] not in recommended_titles]
        initial_compatibilities = [(book, calculate_initial_compatibility(user_book, book)) for book in potential_books]
        
        top_books = sorted(initial_compatibilities, key=lambda x: x[1], reverse=True)[:10]
        refined_books = [(book, score * 0.6 + calculate_description_similarity(user_book.get('description', ''), book.get('description', '')) * 0.4) for book, score in top_books]
        
        refined_books.sort(key=lambda x: x[1], reverse=True)
        
        for book, final_score in refined_books:
            if book['title'] not in recommended_titles:
                recommended_titles.add(book['title'])
                book['score'] = final_score
                recommendations.append(book)
                if len(recommendations) >= total_recommendations:
                    break
        if len(recommendations) >= total_recommendations:
            break

    return recommendations[:total_recommendations]

if __name__ == "__main__":
    try:
        library = json.loads(sys.argv[1])
        user_id = json.loads(sys.argv[2])
        logging.info("Library and user_id received")
        recommendations = asyncio.run(find_best_matches(library, user_id))
        logging.info(f"Library input: {library}")
        logging.info(f"User ID input: {user_id}")
        # Print recommendations as a single JSON array
        print(json.dumps(recommendations))  # Convert the entire list to JSON and print it once
    except Exception as e:
        logging.error(f"Script error: {e}")
        print(json.dumps({"error": f"Script error: {str(e)}"}))
        sys.exit(1)