import sys
import json
import os
import pickle
import pandas as pd
import numpy as np
from pymongo import MongoClient
from bson import ObjectId
from dotenv import load_dotenv
from surprise import SVD, Dataset, Reader, accuracy
from surprise.model_selection import train_test_split, GridSearchCV
from sklearn.decomposition import NMF  # For ALS-like implementation
from sklearn.metrics import mean_squared_error
import torch
import torch.nn as nn
import torch.optim as optim
from datetime import datetime
import requests

load_dotenv()

# MongoDB connection setup
MONGO_URI = os.getenv("MONGODB_URI")
client = MongoClient(MONGO_URI)
db = client["test"]

MODEL_PATH = "svd_model.pkl"
LAST_TRAINED_PATH = "last_trained.txt"

GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes"
API_KEY = os.getenv("API_KEY")  # Store API key in .env

def normalize_rating(rating):
    """Convert 0-100 scale to 1-5 scale"""
    return (rating / 20) + 1

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
                    "userId": str(library["_id"]),
                    "isbn": book["isbn"],
                    "rating": normalize_rating(book["rating"])  # Normalize the rating
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

def print_model_details(model, trainset):
    """
    Print details about the SVD model including dimensions and matrices.
    """
    print("\n=== SVD Model Details ===")
    print(f"Number of factors (k): {model.n_factors}")
    print(f"Number of users: {trainset.n_users}")
    print(f"Number of items: {trainset.n_items}")
    
    # Print first few rows of P (user factors) and Q (item factors) matrices
    print("\nFirst few rows of user factors (P matrix):")
    print(model.pu[:5])
    
    print("\nFirst few rows of item factors (Q matrix):")
    print(model.qi[:5])
    
    # Calculate and print global mean and biases
    ratings = list(trainset.all_ratings())
    global_mean = sum(r for (_, _, r) in ratings) / len(ratings)
    print(f"\nGlobal mean: {global_mean:.2f}")
    print(f"User biases: {model.bu[:5]}")  # First 5 user biases
    print(f"Item biases: {model.bi[:5]}")  # First 5 item biases

def print_interaction_matrix(interaction_matrix):
    """
    Print the interaction matrix in a readable format.
    """
    print("\n=== Interaction Matrix ===")
    print(f"Shape: {interaction_matrix.shape}")
    print("\nFirst 5 rows and columns of the interaction matrix:")
    print(interaction_matrix.iloc[:5, :5])
    print("\nNumber of non-null ratings:", interaction_matrix.count().sum())
    print("Sparsity:", (1 - interaction_matrix.count().sum() / (interaction_matrix.shape[0] * interaction_matrix.shape[1])) * 100, "%")

class MatrixFactorization(nn.Module):
    def __init__(self, n_users, n_items, n_factors=100):
        super().__init__()
        self.user_factors = nn.Embedding(n_users, n_factors)
        self.item_factors = nn.Embedding(n_items, n_factors)
        self.user_bias = nn.Embedding(n_users, 1)
        self.item_bias = nn.Embedding(n_items, 1)
        
        # Initialize weights
        nn.init.normal_(self.user_factors.weight, std=0.1)
        nn.init.normal_(self.item_factors.weight, std=0.1)
        nn.init.zeros_(self.user_bias.weight)
        nn.init.zeros_(self.item_bias.weight)
        
    def forward(self, user_ids, item_ids):
        user_embed = self.user_factors(user_ids)
        item_embed = self.item_factors(item_ids)
        user_bias = self.user_bias(user_ids).squeeze()
        item_bias = self.item_bias(item_ids).squeeze()
        
        return (user_embed * item_embed).sum(dim=1) + user_bias + item_bias

def evaluate_model(model, testset):
    predictions = model.test(testset)
    return accuracy.rmse(predictions)

def train_pytorch_model(train_data, test_data, n_users, n_items, n_factors=100, lr=0.001, n_epochs=20):
    try:
        model = MatrixFactorization(n_users, n_items, n_factors)
        optimizer = optim.Adam(model.parameters(), lr=lr)
        criterion = nn.MSELoss()
        
        # Convert data to PyTorch tensors
        train_users = torch.LongTensor([int(x[0]) for x in train_data])
        train_items = torch.LongTensor([int(x[1]) for x in train_data])
        train_ratings = torch.FloatTensor([x[2] for x in train_data])
        
        # Add batch processing with smaller batch size
        batch_size = 32  # Reduced batch size
        n_batches = len(train_data) // batch_size + 1
        
        print("n_users:", n_users, "max user idx:", max([x[0] for x in train_data]))
        print("n_items:", n_items, "max item idx:", max([x[1] for x in train_data]))
        
        for epoch in range(n_epochs):
            model.train()
            total_loss = 0
            
            # Shuffle the data
            indices = torch.randperm(len(train_data))
            train_users = train_users[indices]
            train_items = train_items[indices]
            train_ratings = train_ratings[indices]
            
            for i in range(n_batches):
                start_idx = i * batch_size
                end_idx = min((i + 1) * batch_size, len(train_data))
                
                if start_idx >= len(train_data):
                    break
                
                batch_users = train_users[start_idx:end_idx]
                batch_items = train_items[start_idx:end_idx]
                batch_ratings = train_ratings[start_idx:end_idx]
                
                optimizer.zero_grad()
                predictions = model(batch_users, batch_items)
                loss = criterion(predictions, batch_ratings)
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
            
            if epoch % 5 == 0:
                print(f'Epoch {epoch}, Average Loss: {total_loss/n_batches:.4f}')
        
        return model
    except Exception as e:
        print(f"Error in PyTorch model training: {str(e)}")
        return None

def compare_models(interactions):
    # Prepare data
    df = pd.DataFrame(interactions)
    reader = Reader(rating_scale=(1, 5))
    data = Dataset.load_from_df(df[['userId', 'isbn', 'rating']], reader)
    
    # Split data
    trainset, testset = train_test_split(data, test_size=0.2, random_state=42)
    
    results = {}
    
    # 1. Surprise SVD (SGD)
    print("\nTraining Surprise SVD (SGD)...")
    try:
        svd_model = SVD(n_factors=100, n_epochs=20, lr_all=0.005, reg_all=0.02)
        svd_model.fit(trainset)
        svd_rmse = evaluate_model(svd_model, testset)
        results['svd_rmse'] = svd_rmse
        results['svd_model'] = svd_model
        print(f"SVD RMSE: {svd_rmse:.4f}")
    except Exception as e:
        print(f"Error in SVD training: {str(e)}")
        results['svd_rmse'] = float('inf')
        results['svd_model'] = None
    
    # 2. ALS (using NMF)
    print("\nTraining ALS (NMF)...")
    try:
        # Create user-item matrix
        user_item_matrix = df.pivot(index='userId', columns='isbn', values='rating').fillna(0)
        print(f"User-item matrix shape: {user_item_matrix.shape}")
        
        # Use a smaller number of components for NMF
        n_components = min(50, min(user_item_matrix.shape))
        nmf = NMF(n_components=n_components, init='random', random_state=42, max_iter=200)
        nmf.fit(user_item_matrix)
        
        # Calculate RMSE for NMF
        nmf_predictions = nmf.transform(user_item_matrix) @ nmf.components_
        nmf_rmse = np.sqrt(mean_squared_error(user_item_matrix.values[user_item_matrix.values != 0],
                                            nmf_predictions[user_item_matrix.values != 0]))
        results['als_rmse'] = nmf_rmse
        results['als_model'] = nmf
        print(f"ALS RMSE: {nmf_rmse:.4f}")
    except Exception as e:
        print(f"Error in ALS training: {str(e)}")
        results['als_rmse'] = float('inf')
        results['als_model'] = None
    
    # 3. PyTorch with Adam (simplified version)
    print("\nTraining PyTorch model with Adam...")
    try:
        # Create user and item mappings
        user_map = {user: idx for idx, user in enumerate(df['userId'].unique())}
        item_map = {item: idx for idx, item in enumerate(df['isbn'].unique())}
        
        # Convert data for PyTorch
        train_data = [(user_map[row['userId']], item_map[row['isbn']], row['rating']) 
                      for _, row in df.iterrows()]
        
        # Use smaller model parameters
        n_factors = 50  # Reduced from 100
        batch_size = 512  # Reduced from 1024
        n_epochs = 10  # Reduced from 20
        
        pytorch_model = train_pytorch_model(train_data, None, 
                                          len(user_map), len(item_map),
                                          n_factors=n_factors, 
                                          lr=0.001, 
                                          n_epochs=n_epochs)
        
        if pytorch_model is not None:
            results['pytorch_model'] = pytorch_model
            # Calculate RMSE for PyTorch model
            pytorch_model.eval()
            with torch.no_grad():
                test_users = torch.LongTensor([user_map[x[0]] for x in testset])
                test_items = torch.LongTensor([item_map[x[1]] for x in testset])
                test_ratings = torch.FloatTensor([x[2] for x in testset])
                
                predictions = pytorch_model(test_users, test_items)
                pytorch_rmse = torch.sqrt(torch.mean((predictions - test_ratings) ** 2)).item()
                results['pytorch_rmse'] = pytorch_rmse
                print(f"PyTorch RMSE: {pytorch_rmse:.4f}")
    except Exception as e:
        print(f"Error in PyTorch model training: {str(e)}")
        results['pytorch_model'] = None
        results['pytorch_rmse'] = float('inf')
    
    # Print final comparison
    print("\n=== Final Model Comparison Results ===")
    print(f"Surprise SVD (SGD) RMSE: {results['svd_rmse']:.4f}")
    print(f"ALS (NMF) RMSE: {results['als_rmse']:.4f}")
    print(f"PyTorch (Adam) RMSE: {results.get('pytorch_rmse', float('inf')):.4f}")
    
    # Select best model based on RMSE
    best_model_name = min(['svd', 'als', 'pytorch'], 
                         key=lambda x: results.get(f'{x}_rmse', float('inf')))
    print(f"\nBest performing model: {best_model_name.upper()}")
    
    return results

def tune_svd_hyperparameters(interactions):
    # Prepare data
    df = pd.DataFrame(interactions)
    reader = Reader(rating_scale=(1, 5))
    data = Dataset.load_from_df(df[['userId', 'isbn', 'rating']], reader)
    
    # Define the parameter grid
    param_grid = {
        'n_factors': [50, 100, 150],
        'n_epochs': [10, 20, 30],
        'lr_all': [0.001, 0.005, 0.01],
        'reg_all': [0.01, 0.02, 0.1]
    }
    
    # Perform grid search
    gs = GridSearchCV(SVD, param_grid, measures=['rmse'], cv=5)
    gs.fit(data)
    
    # Print the best RMSE and parameters
    print("Best RMSE:", gs.best_score['rmse'])
    print("Best parameters:", gs.best_params['rmse'])
    
    return gs.best_params['rmse']

# Modify your main block to include the comparison
if __name__ == "__main__":
    try:
        username = sys.argv[1]
        num_recommendations = int(sys.argv[2]) if len(sys.argv) > 2 else 10

        user_id = get_user_id_by_username(username)
        interactions = fetch_user_data()
        
        # Tune SVD hyperparameters
        best_params = tune_svd_hyperparameters(interactions)
        
        # Run model comparison
        results = compare_models(interactions)
        
        # Use the best model for recommendations
        best_model = results['svd_model']  # You can choose based on RMSE
        recommendations = generate_recommendations(best_model, interactions, user_id, num_recommendations)
        print("\n=== Recommendations ===")
        print(json.dumps(recommendations, indent=4))
    except Exception as e:
        sys.stderr.write(f"[ERROR] {str(e)}\n")
