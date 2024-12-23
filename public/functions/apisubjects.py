import requests

GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
API_KEY = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'  # Replace with your API key

# Define a list of potential genres
potential_subjects = [
    "Fiction", "Non-Fiction", "Mystery", "Fantasy", "Science Fiction",
    "Biography", "Romance", "History", "Children", "Comics",
    "Poetry", "Self-Help", "Philosophy", "Health", "Business", "Travel", "Humor", "Religion"
]

valid_subjects = []

for subject in potential_subjects:
    params = {'q': f'subject:{subject}', 'maxResults': 1, 'key': API_KEY}
    response = requests.get(GOOGLE_BOOKS_API_URL, params=params)
    
    if response.status_code == 200:
        data = response.json()
        if 'items' in data:
            valid_subjects.append(subject)
            print(f"Valid subject: {subject}")
        else:
            print(f"Invalid subject (no results): {subject}")
    else:
        print(f"Error for subject {subject}, Status Code: {response.status_code}")

print("Valid Subjects:", valid_subjects)
