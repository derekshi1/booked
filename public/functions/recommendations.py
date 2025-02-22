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
API_KEY = os.getenv("API_KEY")

# Load the pre-trained sentence transformer model
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

async def fetch_book_info(session, genre, start_index, backoff=1):
    params = {
        'q': f'subject:{genre}',
        'maxResults': 10,
        'startIndex': start_index,
        'key': API_KEY
    }
    async with session.get(GOOGLE_BOOKS_API_URL, params=params) as response:
        if response.status == 200:
            data = await response.json()
            return data.get('items', [])
        elif response.status == 429:
            await asyncio.sleep(backoff)
            return await fetch_book_info(session, genre, start_index, backoff * 2)
        else:
            return []

async def fetch_books_by_genres(genres, max_results=1000):
    books = []
    genre_list = list(genres)
    random.shuffle(genre_list)
    start_indices = {genre: random.randint(0, 500) for genre in genre_list}  # Increase the range of random start indices
    async with aiohttp.ClientSession() as session:
        for genre in genre_list:
            while len(books) < max_results:
                fetched_books = await fetch_book_info(session, genre, start_indices[genre])
                if not fetched_books:
                    break
                for item in fetched_books:
                    volume_info = item.get('volumeInfo')
                    thumbnail = volume_info.get('imageLinks', {}).get('thumbnail')
                    if thumbnail and 'books.google.com' in thumbnail and '150x150' in thumbnail:
                        thumbnail = None  # Treat this as if no thumbnail is available
                    books.append({
                        'title': volume_info.get('title'),
                        'authors': volume_info.get('authors', []),
                        'categories': volume_info.get('categories', []),
                        'publishedDate': volume_info.get('publishedDate', ''),
                        'description': volume_info.get('description', ''),
                        'pageCount': volume_info.get('pageCount', 0),
                        'thumbnail': thumbnail,
                        'isbn': [identifier['identifier'] for identifier in volume_info.get('industryIdentifiers', [])],
                        'score': 0,
                        'related_to': ''
                    })
                start_indices[genre] += random.randint(10, 50)  # Introduce more randomness in the start indices increment
                if len(fetched_books) < 10:  # Break if fewer results were returned than requested
                    break
    return books[:max_results]

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
    
    # Handle category similarity
    categories1 = set(book1.get('categories', []))
    categories2 = set(book2.get('categories', []))
    
    if categories1 and categories2:
        common_categories = categories1.intersection(categories2)
        category_similarity = len(common_categories) / (len(categories1) + len(categories2))
    else:
        # Assign a default similarity score if categories are missing
        # You could also use other heuristics here based on titles, etc.
        category_similarity = 0.5  # Assuming a neutral similarity if categories are missing

    # Handle publication date similarity
    pub_date_similarity = 0
    if book1.get('publishedDate') and book2.get('publishedDate'):
        try:
            year1 = int(book1['publishedDate'][:4])
            year2 = int(book2['publishedDate'][:4])
            pub_date_similarity = 1 - abs(year1 - year2) / max(year1, year2)
        except ValueError:
            pass

    # Calculate the final compatibility score
    compatibility_score = (
        0.8 * category_similarity +  # Decrease weight if relying on a default similarity score
        0.2 * pub_date_similarity     # Increase weight if categories are missing
    )
    
    return compatibility_score * 100


async def find_best_matches(library, total_recommendations=15):
    num_books = len(library)
    base_recommendations_per_book = total_recommendations // num_books
    extra_recommendations = total_recommendations % num_books

    genre_books = defaultdict(list)
    for book in library:
        for genre in book.get('categories', []):
            genre_books[genre].append(book)

    selected_books = []
    for genre, books in genre_books.items():
        selected_books.append(random.choice(books))

    all_genres = set()
    for book in selected_books:
        all_genres.update(book.get('categories', []))

    potential_matches = await fetch_books_by_genres(all_genres, max_results=len(selected_books) * (base_recommendations_per_book + extra_recommendations) * 3)
    random.shuffle(potential_matches)  # Shuffle the potential matches to introduce randomness
    recommended_titles = set()
    book_recommendations = {book['title']: [] for book in selected_books}

    for user_book in selected_books:
        initial_compatibilities = []
        for potential_book in potential_matches:
            if potential_book['title'] not in recommended_titles:
                initial_score = calculate_initial_compatibility(user_book, potential_book)
                # Add the book to initial_compatibilities regardless of the score
                initial_compatibilities.append((potential_book, initial_score))
        initial_compatibilities.sort(key=lambda x: x[1], reverse=True)
        top_initial_matches = initial_compatibilities[:base_recommendations_per_book * 3]
        refined_compatibilities = []
        for match, score in top_initial_matches:
            description_similarity = calculate_description_similarity(user_book.get('description', ''), match.get('description', ''))
            final_score = score * 0.6 + description_similarity * 0.4
            final_score = (final_score / 100) * 200

            match['score'] = final_score
            match['related_to'] = user_book['title']  # Update the related_to field here

            refined_compatibilities.append((match, final_score))
        refined_compatibilities.sort(key=lambda x: x[1], reverse=True)
        count_added = 0
        recommendations_for_this_book = base_recommendations_per_book + (1 if extra_recommendations > 0 else 0)
        for match, _ in refined_compatibilities:
            if match['title'] not in recommended_titles:
                recommended_titles.add(match['title'])
                book_recommendations[user_book['title']].append(match)
                count_added += 1
                if count_added >= recommendations_for_this_book:
                    break
        if extra_recommendations > 0:
            extra_recommendations -= 1


    recommendations = [rec for recs in book_recommendations.values() for rec in recs]

    try:
        recommendations = recommendations[:total_recommendations]
    except Exception as e:
        print(f"Error slicing recommendations: {e}", file=sys.stderr)
        print(f"Recommendations: {json.dumps(recommendations)}", file=sys.stderr)

    if len(recommendations) < total_recommendations:
        additional_recommendations = [book for book in potential_matches if book['title'] not in recommended_titles]
        additional_recommendations.sort(key=lambda x: x['score'], reverse=True)
        recommendations.extend(additional_recommendations[:total_recommendations - len(recommendations)])

    # Ensure exactly 25 recommendations
    if len(recommendations) > total_recommendations:
        recommendations = recommendations[:total_recommendations]
    elif len(recommendations) < total_recommendations:
        additional_recommendations = [book for book in potential_matches if book['title'] not in recommended_titles]
        additional_recommendations.sort(key=lambda x: x['score'], reverse=True)
        recommendations.extend(additional_recommendations[:total_recommendations - len(recommendations)])

    # Print recommendations and their related books
    for rec in recommendations:
        print(f"Recommended Book: {rec['title']} - Related to: {rec['related_to']}", file=sys.stderr)

    return recommendations


if __name__ == "__main__":
    try:
        library = json.loads(sys.argv[1])
        recommendations = asyncio.run(find_best_matches(library, total_recommendations=15))
        print(json.dumps(recommendations))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
