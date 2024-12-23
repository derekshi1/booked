import sys
import json
import random
import requests
from sentence_transformers import SentenceTransformer, util
import os
from dotenv import load_dotenv

load_dotenv()
# Define the Google Books API URL
GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
API_KEY = os.getenv("API_KEY")

# Load the pre-trained sentence transformer model
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

def get_book_info(query):
    params = {
        'q': query,
        'maxResults': 1,
        'key': API_KEY
    }
    response = requests.get(GOOGLE_BOOKS_API_URL, params=params)
    if response.status_code == 200:
        data = response.json()
        if 'items' in data:
            book = data['items'][0]['volumeInfo']
            return {
                'title': book.get('title'),
                'authors': book.get('authors', []),
                'categories': book.get('categories', []),
                'publishedDate': book.get('publishedDate', ''),
                'description': book.get('description', ''),
                'pageCount': book.get('pageCount', 0),
                'thumbnail': book.get('imageLinks', {}).get('thumbnail', 'https://via.placeholder.com/150')
            }
    return None

def find_books_by_genres(genres, max_results=100):
    books = []
    genre_list = list(genres)
    random.shuffle(genre_list)
    start_indices = {genre: random.randint(0, 100) for genre in genre_list}

    sys.stderr.write(f"[DEBUG] Fetching books for genres: {genre_list}\n")

    while len(books) < max_results and genre_list:
        for genre in genre_list:
            if len(books) >= max_results:
                break
            params = {
                'q': f'subject:{genre}',
                'maxResults': 20,
                'startIndex': start_indices[genre],
                'key': API_KEY
            }
            response = requests.get(GOOGLE_BOOKS_API_URL, params=params)
            if response.status_code == 200:
                data = response.json()
                if 'items' in data:
                    for item in data['items']:
                        volume_info = item.get('volumeInfo', {})
                        book = {
                            'title': volume_info.get('title'),
                            'authors': volume_info.get('authors', []),
                            'categories': volume_info.get('categories', []),
                            'description': volume_info.get('description', ''),
                            'thumbnail': volume_info.get('imageLinks', {}).get('thumbnail', 'https://via.placeholder.com/150')
                        }
                        if book not in books:  # Ensure no duplicates
                            books.append(book)
                    start_indices[genre] += 20
                else:
                    sys.stderr.write(f"[DEBUG] No items found for genre: {genre}\n")
                    genre_list.remove(genre)
            else:
                sys.stderr.write(f"[ERROR] Failed to fetch books for genre {genre}, status code: {response.status_code}\n")
                genre_list.remove(genre)

    sys.stderr.write(f"[DEBUG] Total books fetched: {len(books)}\n")
    return books[:max_results]

def find_opposite_least_similar(library, total_recommendations=15):
    sys.stderr.write(f"[DEBUG] Input library size: {len(library)}\n")

    # Step 1: Extract user genres
    user_genres = set()
    for book in library:
        user_genres.update(book.get('categories', []))
    sys.stderr.write(f"[DEBUG] User genres: {user_genres}\n")

    # Step 2: Determine opposite genres
    all_genres = set(["Fiction", "Non-Fiction", "Science", "Biography", "Children",
                      "Fantasy", "Romance", "Mystery", "History", "Poetry",
                      "Science Fiction", "Self-Help", "Philosophy", "Health",
                      "Business", "Travel", "Humor", "Comics", "Religion"])
    opposite_genres = all_genres - user_genres
    sys.stderr.write(f"[DEBUG] Opposite genres: {opposite_genres}\n")

    # Step 3: Fetch books from opposite genres
    potential_matches = find_books_by_genres(opposite_genres, max_results=500)

    # Step 4: Compute similarity scores
    library_embeddings = {
        book['title']: model.encode(book['description']) for book in library if 'description' in book
    }
    sys.stderr.write(f"[DEBUG] Generated {len(library_embeddings)} library embeddings\n")

    ranked_books = []
    for potential_book in potential_matches:
        if 'description' in potential_book:
            potential_embedding = model.encode(potential_book['description'])
            min_similarity = min(
                util.cos_sim(potential_embedding, lib_embedding).item()
                for lib_embedding in library_embeddings.values()
            )
            if potential_book not in [book for book, _ in ranked_books]:  # Ensure no duplicates
                ranked_books.append((potential_book, min_similarity))

    sys.stderr.write(f"[DEBUG] Calculated similarity for {len(ranked_books)} books\n")

    # Step 5: Rank and return recommendations
    ranked_books.sort(key=lambda x: x[1])  # Least similar first
    recommendations = [book for book, _ in ranked_books[:total_recommendations]]

    if not recommendations:
        sys.stderr.write("[INFO] No opposite recommendations found. Fetching random obscure books.\n")
        recommendations = get_random_books(total_recommendations)

    sys.stderr.write(f"[DEBUG] Final recommendations count: {len(recommendations)}\n")
    return recommendations

def get_random_books(total_recommendations=15):
    all_genres = ["Mystery", "Fantasy", "Science Fiction", "Biography", "Romance",
    "History", "Children", "Comics", "Poetry", "Self-Help", "Philosophy",
    "Health", "Business", "Travel", "Humor"]
    random.shuffle(all_genres)
    potential_matches = find_books_by_genres(all_genres, max_results=total_recommendations * 2)
    unique_matches = []
    for book in potential_matches:
        if book not in unique_matches:  # Ensure no duplicates
            unique_matches.append(book)
    random.shuffle(unique_matches)
    return unique_matches[:total_recommendations]

if __name__ == "__main__":
    try:
        library = json.loads(sys.argv[1])
        recommendations = find_opposite_least_similar(library, total_recommendations=15)
        print(json.dumps(recommendations))  # Output recommendations as JSON
    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
