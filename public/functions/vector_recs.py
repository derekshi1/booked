import sys
import json
import random
import asyncio
import pymongo
import requests
from sentence_transformers import SentenceTransformer, util
from collections import defaultdict
from dotenv import load_dotenv
import os

# MongoDB Connection
client = pymongo.MongoClient("mongodb+srv://derekshi:Rsds0601@library.k27zbxq.mongodb.net/?retryWrites=true&w=majority&appName=library")
db = client['book_recommendations']
collection = db['books']

load_dotenv()


# Google Books API URL and API Key
GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
api_key = os.getenv('API_KEY')

# Load the pre-trained sentence transformer model
model = SentenceTransformer('paraphrase-MiniLM-L6-v2')

def calculate_custom_score(book1, book2, description_similarity):
    # Custom scoring function based on categories, publication date, and description similarity
    categories1 = set(book1.get('categories', []))
    categories2 = set(book2.get('categories', []))
    
    category_similarity = 0.5  # Default similarity if categories are missing
    if categories1 and categories2:
        common_categories = categories1.intersection(categories2)
        category_similarity = len(common_categories) / (len(categories1) + len(categories2))
    
    pub_date_similarity = 0
    if book1.get('publishedDate') and book2.get('publishedDate'):
        try:
            year1 = int(book1['publishedDate'][:4])
            year2 = int(book2['publishedDate'][:4])
            pub_date_similarity = 1 - abs(year1 - year2) / max(year1, year2)
        except ValueError:
            pass

    # Combine the similarities into a final score
    final_score = 0.4 * category_similarity + 0.2 * pub_date_similarity + 0.4 * description_similarity
    return final_score * 100

def fetch_books_from_google(query, max_results=10):
    params = {
        'q': query,
        'maxResults': max_results,
        'key': api_key
    }
    response = requests.get(GOOGLE_BOOKS_API_URL, params=params)

    if response.status_code == 200:
        data = response.json()
        books = data.get('items', [])
        return books
    else:
        print(f"Error fetching data from Google Books API: {response.status_code}")
        return []

def process_book_data(book):
    volume_info = book.get('volumeInfo', {})
    return {
        'title': volume_info.get('title', 'Unknown Title'),
        'authors': volume_info.get('authors', []),
        'categories': volume_info.get('categories', []),
        'publishedDate': volume_info.get('publishedDate', ''),
        'description': volume_info.get('description', ''),
        'pageCount': volume_info.get('pageCount', 0),
        'thumbnail': volume_info.get('imageLinks', {}).get('thumbnail', ''),
        'isbn': [identifier['identifier'] for identifier in volume_info.get('industryIdentifiers', [])],
    }

async def find_books_by_vector(description_vector, total_recommendations=25):
    # Perform vector search in MongoDB
    pipeline = [
        {
            "$search": {
                "index": "description_vector_index",  # Replace with your index name
                "knnBeta": {
                    "vector": description_vector.tolist(),
                    "path": "description_vector",
                    "k": total_recommendations * 3,  # Fetch more results to filter later
                    "score": {"function": "cosine"}
                }
            }
        }
    ]
    results = list(collection.aggregate(pipeline))
    return results

async def find_best_matches(library, total_recommendations=25):
    selected_books = []
    for book in library:
        selected_books.append(book)

    recommendations = []
    recommended_titles = set()

    for user_book in selected_books:
        description = user_book.get('description', '')
        description_vector = model.encode(description)
        potential_matches = await find_books_by_vector(description_vector, total_recommendations)

        initial_compatibilities = []
        for potential_book in potential_matches:
            if potential_book['title'] not in recommended_titles:
                description_similarity = potential_book['score']
                custom_score = calculate_custom_score(user_book, potential_book, description_similarity)
                initial_compatibilities.append((potential_book, custom_score))

        initial_compatibilities.sort(key=lambda x: x[1], reverse=True)
        refined_matches = initial_compatibilities[:total_recommendations]
        
        for match, score in refined_matches:
            if match['title'] not in recommended_titles:
                match['score'] = score
                match['related_to'] = user_book['title']
                recommendations.append(match)
                recommended_titles.add(match['title'])
                if len(recommendations) >= total_recommendations:
                    break

    return recommendations

async def dynamic_recommendations(library, total_recommendations=25):
    recommendations = []

    if len(library) > 25:
        # Randomly select 8 books from the library
        selected_books = random.sample(library, 8)
        # Get 3 recommendations for each selected book
        for book in selected_books:
            book_recommendations = await find_best_matches([book], total_recommendations=3)
            recommendations.extend(book_recommendations)
        # Add 1 more recommendation for a random book
        random_book = random.choice(library)
        additional_recommendation = await find_best_matches([random_book], total_recommendations=1)
        recommendations.extend(additional_recommendation)
    else:
        # Distribute recommendations across the books in the library
        base_recommendations_per_book = total_recommendations // len(library)
        extra_recommendations = total_recommendations % len(library)

        for idx, book in enumerate(library):
            num_recommendations = base_recommendations_per_book
            if idx < extra_recommendations:
                num_recommendations += 1

            book_recommendations = await find_best_matches([book], total_recommendations=num_recommendations)
            recommendations.extend(book_recommendations)

    return recommendations

if __name__ == "__main__":
    try:
        library = json.loads(sys.argv[1])
        recommendations = asyncio.run(dynamic_recommendations(library, total_recommendations=25))
        print(json.dumps(recommendations, indent=4))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
