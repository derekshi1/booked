import os
import json
import sys
import requests
import spacy
from collections import Counter
from spacy.matcher import Matcher

# Open Library API URL
OPEN_LIBRARY_API_URL = "http://openlibrary.org/search.json"

# Load the spaCy NLP model
nlp = spacy.load("en_core_web_sm")

def fetch_books(query, year_min=None, page_min=None, category=None, sort=None):
    params = {
        'q': query,
        'limit': 1000
    }
    if category:
        params['subject'] = category
    if sort:
        params['sort'] = sort

    response = requests.get(OPEN_LIBRARY_API_URL, params=params)
    response.raise_for_status()
    return response.json().get('docs', [])

def extract_keywords(text):
    doc = nlp(text)
    keywords = [token.lemma_ for token in doc if token.is_alpha and not token.is_stop]
    return Counter(keywords)

def filter_books(books, year_min=None, page_min=None):
    filtered_books = []
    for book in books:
        if year_min and book.get('first_publish_year', 0) < year_min:
            continue
        if page_min and book.get('number_of_pages_median', 0) < page_min:
            continue
        filtered_books.append(book)
    return filtered_books

def convert_isbn10_to_isbn13(isbn10):
    prefix = '978'
    core = isbn10[:-1]
    isbn13 = prefix + core

    check_digit = 0
    for i, char in enumerate(isbn13):
        if i % 2 == 0:
            check_digit += int(char)
        else:
            check_digit += 3 * int(char)
    check_digit = (10 - (check_digit % 10)) % 10

    return isbn13 + str(check_digit)

def get_isbn(book):
    isbns = book.get('isbn', [])
    for isbn in isbns:
        if len(isbn) == 13:
            return isbn
        elif len(isbn) == 10:
            return convert_isbn10_to_isbn13(isbn)
    return None

def parse_query(query):
    doc = nlp(query)
    year_min = None
    page_min = None
    categories = []
    keywords = []
    
    matcher = Matcher(nlp.vocab)
    matcher.add("YearPattern", [[{"LIKE_NUM": True, "LENGTH": 4}]])
    matcher.add("PagePattern", [[{"LIKE_NUM": True}, {"LOWER": {"IN": ["page", "pages"]}}]])
    
    matches = matcher(doc)
    for match_id, start, end in matches:
        span = doc[start:end]
        if nlp.vocab.strings[match_id] == "YearPattern":
            year_min = int(span.text)
        elif nlp.vocab.strings[match_id] == "PagePattern":
            page_min = int(span[0].text)
    
    for token in doc:
        if token.pos_ in ['NOUN', 'PROPN', 'ADJ'] and not token.is_stop:
            keywords.append(token.lemma_)
    
    keywords_str = ' '.join(keywords)
    categories = [kw for kw in keywords if kw.lower() in ['romance', 'fiction', 'mystery', 'fantasy', 'science', 'biography', 'history']] # Example categories
    
    return year_min, page_min, categories[0] if categories else None

def generate_recommendations(query):
    try:
        year_min, page_min, category = parse_query(query)
        print(f"Parsed query: year_min={year_min}, page_min={page_min}, category={category}", file=sys.stderr)
        
        all_books = fetch_books(query, year_min, page_min, category)
        print(f"Total books fetched: {len(all_books)}", file=sys.stderr)

        filtered_books = filter_books(all_books, year_min, page_min)
        print(f"Total books after filtering: {len(filtered_books)}", file=sys.stderr)
        
        recommendations = []
        for book in filtered_books[:28]:  # Top 20 recommendations
            isbn = get_isbn(book)
            recommendations.append({
                'title': book.get('title', 'No title available'),
                'authors': book.get('author_name', []),
                'thumbnail': f"http://covers.openlibrary.org/b/id/{book.get('cover_i', 'default')}-L.jpg",
                'description': book.get('first_sentence', {}).get('value', 'No description available') if isinstance(book.get('first_sentence'), dict) else 'No description available',
                'year': book.get('first_publish_year', 'Unknown'),
                'pages': book.get('number_of_pages_median', 'Unknown'),
                'isbn': isbn
            })
        
        print(f"Generated recommendations: {recommendations}", file=sys.stderr)
        return recommendations

    except Exception as e:
        print(f"Error during recommendation generation: {e}", file=sys.stderr)
        return {"error": str(e)}

if __name__ == "__main__":
    try:
        if len(sys.argv) > 1:
            query = ' '.join(sys.argv[1:])
            recommendations = generate_recommendations(query)
            print(json.dumps({"list": recommendations}, indent=2))
        else:
            print(json.dumps({"error": "No query provided"}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
