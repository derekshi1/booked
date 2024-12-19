import sys
import json
import os
import pickle
import pandas as pd
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv
from surprise import SVD, Dataset, Reader
from datetime import datetime
import requests

load_dotenv()

# MongoDB connection setup
MONGO_URI = os.getenv("MONGODB_URI")
sys.stderr.write(f"[DEBUG] MongoDB URI: {MONGO_URI}\n")
client = MongoClient(MONGO_URI)
db = client["test"]

MODEL_PATH = "svd_model.pkl"
LAST_TRAINED_PATH = "last_trained.txt"

GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
API_KEY = os.getenv("API_KEY")  # Store API key in .env

# Fetch user interactions from MongoDB
def fetch_user_data():
    sys.stderr.write("[DEBUG] Fetching user-library data from MongoDB...\n")
    user_libraries = db.userlibraries.find()
    interaction_data = []

    for library in user_libraries:
        username = library.get("username")
        sys.stderr.write(f"[DEBUG] Processing user: {username}\n")
        for book in library.get("books", []):
            if "rating" in book and book["rating"] is not None:
                sys.stderr.write(f"[DEBUG] Found rating: {book['rating']} for ISBN: {book['isbn']}\n")
                interaction_data.append({
                    "userId": str(library["_id"]),  # Use MongoDB _id as userId
                    "isbn": book["isbn"],
                    "rating": book["rating"]
                })
    sys.stderr.write(f"[DEBUG] Total interactions fetched: {len(interaction_data)}\n")
    return interaction_data

# Train and save the SVD model
def train_and_save_model(interactions):
    sys.stderr.write("[DEBUG] Training the SVD model...\n")
    if not interactions:
        raise ValueError("No interactions found to train the model.")

    df = pd.DataFrame(interactions)
    sys.stderr.write(f"[DEBUG] Training data size: {df.shape}\n")

    reader = Reader(rating_scale=(1, 5))
    data = Dataset.load_from_df(df[['userId', 'isbn', 'rating']], reader)

    trainset = data.build_full_trainset()
    model = SVD()
    model.fit(trainset)

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)

    with open(LAST_TRAINED_PATH, "w") as f:
        f.write(datetime.now().isoformat())

    sys.stderr.write("[DEBUG] Model trained and saved successfully.\n")

# Check if the model needs retraining
def needs_retraining():
    sys.stderr.write("[DEBUG] Checking if model retraining is needed...\n")
    if not os.path.exists(MODEL_PATH) or not os.path.exists(LAST_TRAINED_PATH):
        sys.stderr.write("[DEBUG] Model or timestamp file not found. Retraining required.\n")
        return True

    with open(LAST_TRAINED_PATH, "r") as f:
        last_trained = datetime.fromisoformat(f.read().strip())
    sys.stderr.write(f"[DEBUG] Last trained timestamp: {last_trained}\n")

    retrain = (datetime.now() - last_trained).total_seconds() > 86400
    sys.stderr.write(f"[DEBUG] Retraining required: {retrain}\n")
    return retrain

# Load the pre-trained SVD model
def load_model():
    sys.stderr.write("[DEBUG] Loading the SVD model...\n")
    interactions = fetch_user_data()

    if needs_retraining():
        sys.stderr.write("[DEBUG] Model needs retraining.\n")
        train_and_save_model(interactions)

    with open(MODEL_PATH, "rb") as f:
        sys.stderr.write("[DEBUG] Model loaded successfully.\n")
        return pickle.load(f)

# Fetch book metadata from Google Books API
def fetch_metadata(isbn):
    """
    Fetch metadata for a book using its ISBN from Google Books API.
    """
    params = {"q": f"isbn:{isbn}", "key": API_KEY}
    try:
        response = requests.get(GOOGLE_BOOKS_API_URL, params=params)
        if response.status_code == 200:
            data = response.json()
            if "items" in data and len(data["items"]) > 0:
                volume_info = data["items"][0]["volumeInfo"]
                return {
                    "title": volume_info.get("title", "Unknown Title"),
                    "authors": volume_info.get("authors", ["Unknown Author"]),
                    "thumbnail": volume_info.get("imageLinks", {}).get("thumbnail", None),
                    "categories": volume_info.get("categories", []),
                    "description": volume_info.get("description", ""),
                }
        sys.stderr.write(f"[DEBUG] Metadata not found for ISBN: {isbn}\n")
        return None
    except Exception as e:
        sys.stderr.write(f"[ERROR] Failed to fetch metadata for ISBN {isbn}: {e}\n")
        return None

# Generate recommendations using the pre-trained model
def generate_recommendations(model, interactions, user_id, num_recommendations=10):
    sys.stderr.write(f"[DEBUG] Generating recommendations for user_id: {user_id}...\n")
    df = pd.DataFrame(interactions)

    user_rated_books = df[df['userId'] == user_id]["isbn"].tolist()
    sys.stderr.write(f"[DEBUG] Books already rated by user: {len(user_rated_books)}\n")

    all_books = [isbn for isbn in df["isbn"].unique() if isbn not in user_rated_books]
    sys.stderr.write(f"[DEBUG] Total books available for recommendation: {len(all_books)}\n")

    predictions = []
    for book_id in all_books:
        prediction = model.predict(user_id, book_id)
        predictions.append((book_id, prediction.est))

    predictions.sort(key=lambda x: x[1], reverse=True)

    recommended_books = []
    for isbn, score in predictions[:num_recommendations]:
        book = db.books.find_one({"isbn": isbn})
        if not book:
            sys.stderr.write(f"[DEBUG] Fetching metadata for missing book (ISBN: {isbn})\n")
            metadata = fetch_metadata(isbn)
            if metadata:
                book = {
                    "isbn": isbn,
                    "title": metadata["title"],
                    "authors": metadata["authors"],
                    "thumbnail": metadata["thumbnail"],
                    "categories": metadata["categories"],
                    "description": metadata["description"],
                }
        if book:
            recommended_books.append({
                "isbn": isbn,
                "title": book.get("title"),
                "authors": book.get("authors"),
                "thumbnail": book.get("thumbnail"),
                "score": score,
            })
    sys.stderr.write(f"[DEBUG] Total recommendations generated: {len(recommended_books)}\n")
    return recommended_books

def get_user_id_by_username(username):
    sys.stderr.write(f"[DEBUG] Fetching user_id for username: {username}...\n")
    user = db.userlibraries.find_one({"username": username})
    if user:
        user_id = str(user["_id"])
        sys.stderr.write(f"[DEBUG] Found user_id: {user_id}\n")
        return user_id
    else:
        raise ValueError(f"User '{username}' not found in the database.")

if __name__ == "__main__":
    try:
        username = sys.argv[1]
        num_recommendations = int(sys.argv[2]) if len(sys.argv) > 2 else 10

        user_id = get_user_id_by_username(username)

        model = load_model()

        interactions = fetch_user_data()

        recommendations = generate_recommendations(model, interactions, user_id, num_recommendations)

        print(json.dumps(recommendations, indent=4))
    except Exception as e:
        sys.stderr.write(f"[ERROR] {str(e)}\n")
