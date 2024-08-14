import sys
import json
import requests
from sentence_transformers import SentenceTransformer, util
import random
import time
import asyncio
import aiohttp
import aiofiles

# Define the Google Books API URL
GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
API_KEY = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'
# Load the pre-trained sentence transformer model
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')


async def get_book_info(isbn):
    params = {
        'q': f'isbn:{isbn}',
        'maxResults': 1,
        'key': API_KEY
    }
    async with aiohttp.ClientSession() as session:
        async with session.get(GOOGLE_BOOKS_API_URL, params=params) as response:
            if response.status == 200:
                data = await response.json()
                if 'items' in data:
                    book = data['items'][0]['volumeInfo']
                    isbn_13 = next(
                        (identifier['identifier'] for identifier in book.get('industryIdentifiers', [])
                         if identifier['type'] == 'ISBN_13'), None)
                    return {
                        'title': book.get('title'),
                        'authors': book.get('authors', []),
                        'categories': book.get('categories', []),
                        'publishedDate': book.get('publishedDate', ''),
                        'description': book.get('description', ''),
                        'pageCount': book.get('pageCount', 0),
                        'publisher': book.get('publisher', ''),
                        'isbn': isbn_13,
                        'language': book.get('language', ''),
                        'averageRating': book.get('averageRating', 0),
                        'thumbnail': book.get('imageLinks', {}).get('thumbnail', 'https://via.placeholder.com/150')
                    }
    return None

def calculate_description_similarity(desc1, desc2):
    if not desc1 or not desc2:
        return 0
    embeddings1 = model.encode(desc1, convert_to_tensor=True)
    embeddings2 = model.encode(desc2, convert_to_tensor=True)
    similarity = util.pytorch_cos_sim(embeddings1, embeddings2)
    return similarity.item()

def calculate_initial_compatibility(book1, book2):
    if not book1 or not book2:
        return 0
    common_categories = set(book1.get('categories', [])).intersection(set(book2.get('categories', [])))
    category_similarity = len(common_categories) / (len(book1.get('categories', [])) + len(book2.get('categories', [])))
    pub_date_similarity = 0
    if book1.get('publishedDate') and book2.get('publishedDate'):
        try:
            year1 = int(book1['publishedDate'][:4])
            year2 = int(book2['publishedDate'][:4])
            pub_date_similarity = 1 - abs(year1 - year2) / max(year1, year2)
        except ValueError:
            pass
    compatibility_score = (
        0.8 * category_similarity +
        0.2 * pub_date_similarity
    )
    return compatibility_score * 100

async def fetch_books_by_genre(session, genre, start_index, max_results):
    params = {
        'q': f'subject:{genre}',
        'maxResults': max_results,
        'startIndex': start_index,
        'key': API_KEY
    }
    async with session.get(GOOGLE_BOOKS_API_URL, params=params) as response:
        if response.status == 200:
            data = await response.json()
            if 'items' in data:
                books = []
                for item in data['items']:
                    volume_info = item.get('volumeInfo')
                    isbn_13 = next(
                        (identifier['identifier'] for identifier in volume_info.get('industryIdentifiers', [])
                         if identifier['type'] == 'ISBN_13'), None)
                    books.append({
                        'title': volume_info.get('title'),
                        'authors': volume_info.get('authors', []),
                        'categories': volume_info.get('categories', []),
                        'publishedDate': volume_info.get('publishedDate', ''),
                        'description': volume_info.get('description', ''),
                        'pageCount': volume_info.get('pageCount', 0),
                        'thumbnail': volume_info.get('imageLinks', {}).get('thumbnail', 'https://via.placeholder.com/150'),
                        'isbn': isbn_13,
                        'score': 0,
                        'related_to': ''
                    })
                return books
    return []

async def find_books_by_genres(genres, max_results=500):
    books = []
    genre_list = list(genres)
    random.shuffle(genre_list)
    start_indices = {genre: random.randint(0, 100) for genre in genre_list}

    async with aiohttp.ClientSession() as session:
        tasks = []
        for genre in genre_list:
            tasks.append(fetch_books_by_genre(session, genre, start_indices[genre], max_results // len(genre_list)))

        results = await asyncio.gather(*tasks)
        for result in results:
            books.extend(result)

    return books[:max_results]

async def find_best_matches(book, total_recommendations=7):
    recommendations_per_book = total_recommendations
    extra_recommendations = 0

    all_genres = set(book['categories'])
    potential_matches = await find_books_by_genres(all_genres, max_results=recommendations_per_book * 3)

    recommended_titles = set()
    book_recommendations = []

    initial_compatibilities = []
    for potential_book in potential_matches:
        if potential_book['title'] not in recommended_titles:
            initial_score = calculate_initial_compatibility(book, potential_book)
            if initial_score > 0:
                initial_compatibilities.append((potential_book, initial_score))
    initial_compatibilities.sort(key=lambda x: x[1], reverse=True)
    top_initial_matches = initial_compatibilities[:recommendations_per_book * 3]
    refined_compatibilities = []
    for match, score in top_initial_matches:
        description_similarity = calculate_description_similarity(book.get('description', ''), match.get('description', ''))
        final_score = score * 0.4 + description_similarity * 0.6
        final_score = (final_score / 100) * 200

        match['score'] = final_score
        match['related_to'] = book['title']
        refined_compatibilities.append((match, final_score))

    refined_compatibilities.sort(key=lambda x: x[1], reverse=True)
    count_added = 0
    for match in refined_compatibilities:
        if match[0]['title'] not in recommended_titles:
            recommended_titles.add(match[0]['title'])
            book_recommendations.append(match[0])
            count_added += 1
            if count_added >= recommendations_per_book + (1 if extra_recommendations > 0 else 0):
                break
        if extra_recommendations > 0:
            extra_recommendations -= 1

    recommendations = book_recommendations[:total_recommendations]

    if len(recommendations) < total_recommendations:
        additional_recommendations = [book for book in potential_matches if book['title'] not in recommended_titles]
        additional_recommendations.sort(key=lambda x: x['score'], reverse=True)
        recommendations.extend(additional_recommendations[:total_recommendations - len(recommendations)])    

    return recommendations

if __name__ == "__main__":
    try:
        book_isbn = sys.argv[1]
        book_info = asyncio.run(get_book_info(book_isbn))
        if not book_info:
            print("Error: Book not found", file=sys.stderr)
            sys.exit(1)
        recommendations = asyncio.run(find_best_matches(book_info))
        print(json.dumps(recommendations))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
