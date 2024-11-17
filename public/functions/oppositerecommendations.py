import sys
import json
import random
import requests
from sentence_transformers import SentenceTransformer, util

# Define the Google Books API URL
GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
API_KEY = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'  # Replace with your API key

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

def calculate_opposite_compatibility(book1, book2):
    if not book1 or not book2:
        return 0
    # Opposite categories
    common_categories = set(book1.get('categories', [])).intersection(set(book2.get('categories', [])))
    category_length_sum = len(book1.get('categories', [])) + len(book2.get('categories', []))
    if category_length_sum == 0:
        category_opposite = 0  # Or some other default value
    else:
        category_opposite = 1 - (len(common_categories) / category_length_sum)  
    # Opposite publication dates
    pub_date_opposite = 0
    if book1.get('publishedDate') and book2.get('publishedDate'):
        try:
            year1 = int(book1['publishedDate'][:4])
            year2 = int(book2['publishedDate'][:4])
            pub_date_opposite = abs(year1 - year2) / max(year1, year2)
        except ValueError:
            pass
    
    # Combine opposite criteria
    compatibility_score = (
        0.9 * category_opposite +  # Increase weight for category opposite
        0.1 * pub_date_opposite    # Decrease weight for pub date opposite
    )
    return compatibility_score * 100

def find_books_by_genres(genres, max_results=500):
    books = []
    genre_list = list(genres)
    random.shuffle(genre_list)
    start_indices = {genre: random.randint(0, 100) for genre in genre_list}

    while len(books) < max_results and genre_list:
        for genre in genre_list:
            if len(books) >= max_results:
                break
            params = {
                'q': f'subject:{genre}',
                'maxResults': random.randint(10, 30),
                'startIndex': start_indices[genre],
                'key': API_KEY
            }
            response = requests.get(GOOGLE_BOOKS_API_URL, params=params)
            
            if response.status_code == 200:
                data = response.json()
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
                            'isbn': [identifier['identifier'] for identifier in volume_info.get('industryIdentifiers', [])],
                            'score': 0,
                            'related_to': ''
                        })
                    start_indices[genre] += random.randint(20, 40)
                else:
                    genre_list.remove(genre)
            else:
                genre_list.remove(genre)
    return books[:max_results]

def find_opposite_matches(library, total_recommendations=15):
    recommendations_per_book = total_recommendations // len(library)
    extra_recommendations = total_recommendations % len(library)

    user_genres = set()
    for book in library:
        user_genres.update(book.get('categories', []))

    all_genres = set(["Fiction", "Non-Fiction", "Science", "Biography", "Children", "Fantasy", "Romance", "Mystery", "History", "Poetry", "Science Fiction", "Self-Help", "Philosophy", "Health", "Business", "Travel", "Humor", "Comics", "Religion"])  # You can add more genres here
    opposite_genres = all_genres - user_genres

    potential_matches = find_books_by_genres(opposite_genres, max_results=len(library) * recommendations_per_book * 3)

    recommended_titles = set()
    book_recommendations = {book['title']: [] for book in library}
    
    for user_book in library:
        initial_compatibilities = []
        for potential_book in potential_matches:
            if potential_book['title'] not in recommended_titles:
                initial_score = calculate_opposite_compatibility(user_book, potential_book)
                if initial_score > 0:
                    initial_compatibilities.append((potential_book, initial_score))
        initial_compatibilities.sort(key=lambda x: x[1], reverse=True)
        top_initial_matches = initial_compatibilities[:recommendations_per_book * 3]
        refined_compatibilities = []
        for match, score in top_initial_matches:
            match['score'] = score
            match['related_to'] = user_book['title']
            refined_compatibilities.append((match, score))

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
        #print(f"Recommendations: {json.dumps(recommendations)}", file=sys.stderr)

    if len(recommendations) < total_recommendations:
        additional_recommendations = [book for book in potential_matches if book['title'] not in recommended_titles]
        additional_recommendations.sort(key=lambda x: x['score'], reverse=True)
        recommendations.extend(additional_recommendations[:total_recommendations - len(recommendations)])    
    
    return recommendations

def get_random_books(total_recommendations=15):
    all_genres = ["Fiction", "Non-Fiction", "Science", "Biography", "Children", "Fantasy", "Romance", "Mystery", "History", "Poetry", "Science Fiction", "Self-Help", "Philosophy", "Health", "Business", "Travel", "Humor", "Comics", "Religion"]  # You can add more genres here
    random.shuffle(all_genres)
    potential_matches = find_books_by_genres(all_genres, max_results=total_recommendations * 3)
    random.shuffle(potential_matches)
    recommendations = potential_matches[:total_recommendations]

    return recommendations

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            library = json.loads(sys.argv[1])
            if not library:
                recommendations = get_random_books()  # If library is empty, get random books
            else:
                recommendations = find_opposite_matches(library)
        else:
            recommendations = get_random_books()
        print(json.dumps(recommendations))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        # Return an empty list if an error occurs
        print(json.dumps([]))
