import sys
import json
import random
import requests
from difflib import SequenceMatcher
from sentence_transformers import SentenceTransformer, util

# Define the Google Books API URL
GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"

# Load the pre-trained sentence transformer model
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

def get_book_info(query):
    params = {
        'q': query,
        'maxResults': 1
    }
    response = requests.get(GOOGLE_BOOKS_API_URL, params=params)
    if response.status_code == 200:
        data = response.json()
        if 'items' in data:
            book = data['items'][0]['volumeInfo']
            return {
                'title': book.get('title'),
                'authors': book.get('authors', []),  # Default to empty list if None
                'categories': book.get('categories', []),  # Default to empty list if None
                'publishedDate': book.get('publishedDate', ''),  # Default to empty string if None
                'description': book.get('description', ''),
                'pageCount': book.get('pageCount', 0),
                'publisher': book.get('publisher', ''),
                'isbn': [identifier['identifier'] for identifier in book.get('industryIdentifiers', [])],
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
                           0.2 * pub_date_similarity)
    return compatibility_score * 100

def find_books_by_genres(genres, max_results=200):
    books = []
    genre_list = list(genres)
    random.shuffle(genre_list)
    start_indices = {genre: random.randint(0, 100) for genre in genre_list}
    
    # Log the genres being queried
    print(f"Genres being queried: {genre_list}", file=sys.stderr)
    
    while len(books) < max_results and genre_list:
        for genre in genre_list:
            if len(books) >= max_results:
                break
            params = {
                'q': f'subject:{genre}',
                'maxResults': random.randint(10, 30),
                'startIndex': start_indices[genre]
            }
            response = requests.get(GOOGLE_BOOKS_API_URL, params=params)
            
            # Log the API response status and URL
            print(f"Querying genre: {genre}, Response status: {response.status_code}, URL: {response.url}", file=sys.stderr)
            
            if response.status_code == 200:
                data = response.json()
                
                # Log the number of items found
                print(f"Items found for genre {genre}: {len(data.get('items', []))}", file=sys.stderr)
                
                if 'items' in data:
                    for item in data['items']:
                        volume_info = item.get('volumeInfo')
                        books.append({
                            'title': volume_info.get('title'),
                            'authors': volume_info.get('authors', []),
                            'categories': volume_info.get('categories', []),
                            'publishedDate': volume_info.get('publishedDate', ''),
                            'description': volume_info.get('description', ''),
                            'pageCount': volume_info.get('pageCount', 0),
                            'thumbnail': volume_info.get('imageLinks', {}).get('thumbnail', 'https://via.placeholder.com/150'),
                            'isbn' : [identifier['identifier'] for identifier in volume_info.get('industryIdentifiers', [])],
                            'score' : 0,
                            'related_to' : ''
                        })
                    start_indices[genre] += random.randint(20, 40)
                else:
                    genre_list.remove(genre)
            else:
                genre_list.remove(genre)
    return books[:max_results]

def find_best_matches(library, total_recommendations=20):
    recommendations_per_book = total_recommendations // len(library)
    extra_recommendations = total_recommendations // len(library)

    # Log the user library and categories being used
    print(f"User Library: {json.dumps(library)}", file=sys.stderr)
    all_genres = set()

    # Check and log each book's categories
    for book in library:
        # Logging categories using both dot notation and get method
        categories_dot = book['categories'] if 'categories' in book else []
        categories_get = book.get('categories', [])
        
        print(f"Book Title: {book['title']}", file=sys.stderr)
        print(f"Categories (dot notation): {categories_dot}", file=sys.stderr)
        print(f"Categories (get method): {categories_get}", file=sys.stderr)
        
        # Add categories to the set
        all_genres.update(categories_get)

    print(f"All genres derived from user library: {all_genres}", file=sys.stderr)
    
    potential_matches = find_books_by_genres(all_genres, max_results=len(library) * recommendations_per_book * 3)
    
    # Log the potential matches found
    print(f"Potential Matches: {json.dumps(potential_matches)}", file=sys.stderr)
    
    recommended_titles = set()
    book_recommendations = {book['title']: [] for book in library}
    
    for user_book in library:
        initial_compatibilities = []
        for potential_book in potential_matches:
            if potential_book['title'] not in recommended_titles:
                initial_score = calculate_initial_compatibility(user_book, potential_book)
                
                # Log the compatibility calculation
                print(f"Initial Compatibility for {user_book['title']} and {potential_book['title']}: {initial_score}", file=sys.stderr)
                
                if initial_score > 0:
                    initial_compatibilities.append((potential_book, initial_score))
        initial_compatibilities.sort(key=lambda x: x[1], reverse=True)
        top_initial_matches = initial_compatibilities[:recommendations_per_book * 3]
        refined_compatibilities = []
        for match, score in top_initial_matches:
            description_similarity = calculate_description_similarity(user_book.get('description', ''), match.get('description', ''))
            final_score = score * 0.4 + description_similarity * 0.6
            final_score = (final_score / 100) * 200

            try:
                if isinstance(match, tuple) and isinstance(match[0], dict):
                    match[0]['score'] = final_score
                    match[0]['related_to'] = user_book['title']
                else:
                    print(f"Unexpected structure in match: {match}", file=sys.stderr)
            except KeyError as e:
                print(f"Error adding score and related_to: {e}", file=sys.stderr)
                print(f"Match: {json.dumps(match[0])}", file=sys.stderr)
                continue

            # Log the refined compatibility score
            print(f"Refined Compatibility for {user_book['title']} and {match['title']}: {final_score}", file=sys.stderr)
            
            refined_compatibilities.append((match, final_score))
        refined_compatibilities.sort(key=lambda x: x[1], reverse=True)
        count_added = 0
        for match in refined_compatibilities:
            if match[0]['title'] not in recommended_titles:
                recommended_titles.add(match[0]['title'])
                book_recommendations[user_book['title']].append(match[0])
                count_added += 1
                if count_added >= recommendations_per_book + (1 if extra_recommendations > 0 else 0):
                    break
        if extra_recommendations > 0:
            extra_recommendations -= 1
    
    recommendations = [rec for recs in book_recommendations.values() for rec in recs]
    
    try:
        recommendations = recommendations[:total_recommendations]
    except Exception as e:
        print(f"Error slicing recommendations: {e}", file=sys.stderr)
        print(f"Recommendations: {json.dumps(recommendations)}", file=sys.stderr)
    
    return recommendations

if __name__ == "__main__":
    try:
        library = json.loads(sys.argv[1])
        recommendations = find_best_matches(library)
        print(json.dumps(recommendations))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)