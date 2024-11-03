import requests
import sys
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env file

# Google Books API URL and API Key
GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"  # Replace with your actual server URL
API_KEY = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'

def cget_book_info():
    com_keywords = ['fun', 'comedy', 'laugh', 'hilarious', 'funny', 'joke']
    
    # Placeholder for storing books
    com_books = []
    
    # Loop through each keyword and fetch books
    for keyword in com_keywords:
        response = requests.get(GOOGLE_BOOKS_API_URL, params={'q': keyword, 'key': API_KEY})
        if response.status_code == 200:
            books_data = response.json()
            # Assuming 'items' contains the list of books from the Google Books API response
            books = books_data.get('items', [])
            com_books.extend(books)
        else:
            print(f"Failed to fetch books for keyword: {keyword}, Status Code: {response.status_code}")

    # Prepare output format
    books_output = []
    for book in com_books:
        book_info = {
            'title': book['volumeInfo']['title'],
            'authors': book['volumeInfo'].get('authors', []),
            'description': book['volumeInfo'].get('description', ''),
            'categories': book['volumeInfo'].get('categories', []),
            'publishedDate': book['volumeInfo'].get('publishedDate', ''),
            'thumbnail': book['volumeInfo'].get('imageLinks', {}).get('thumbnail', '')
        }
        books_output.append(book_info)

    return books_output

# Example usage
if __name__ == "__main__":
    try:
        # Fetch sad books and print them as JSON
        recommendations = cget_book_info()
        print(json.dumps(recommendations))
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        # Return an empty list if an error occurs
        print(json.dumps([]))
