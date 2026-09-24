import json
import sys
import logging
from collections import Counter, defaultdict
import numpy as np
from sklearn.cluster import KMeans, AgglomerativeClustering
from sklearn.mixture import GaussianMixture
from sklearn.preprocessing import StandardScaler
from itertools import combinations

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Define archetype weights globally
archetype_weights = {
    'Scholar': {
        'Philosophy': {'weight': 1.0, 'related': ['Science', 'Psychology', 'History']},
        'Science': {'weight': 1.0, 'related': ['Mathematics', 'Technology', 'Philosophy']},
        'Psychology': {'weight': 0.8, 'related': ['Philosophy', 'Self-Help', 'Science']},
        'Business & Economics': {'weight': 0.6, 'related': ['Psychology', 'Science', 'History']}
    },
    'Knight': {
        'Fantasy': {'weight': 1.0, 'related': ['Adventure', 'Science Fiction', 'Mythology']},
        'Science Fiction': {'weight': 0.8, 'related': ['Fantasy', 'Technology', 'Adventure']},
        'Adventure': {'weight': 0.6, 'related': ['Fantasy', 'Action', 'Thriller']}
    },
    'Explorer': {
        'Travel': {'weight': 1.0, 'related': ['Geography', 'History', 'Culture']},
        'History': {'weight': 0.8, 'related': ['Geography', 'Politics', 'Culture']},
        'Geography': {'weight': 0.6, 'related': ['Travel', 'Science', 'History']}
    },
    'Romantic': {
        'Fiction': {'weight': 1.0, 'related': ['Romance', 'Drama', 'Poetry']},
        'Romance': {'weight': 1.0, 'related': ['Fiction', 'Drama', 'Poetry']},
        'Psychology': {'weight': 0.6, 'related': ['Fiction', 'Self-Help', 'Philosophy']}
    },
    'Sage': {
        'Self-Help': {'weight': 1.0, 'related': ['Psychology', 'Philosophy', 'Spirituality']},
        'Philosophy': {'weight': 0.8, 'related': ['Psychology', 'Religion', 'Science']},
        'Psychology': {'weight': 0.6, 'related': ['Self-Help', 'Philosophy', 'Science']}
    },
    'Artist': {
        'Fiction': {'weight': 1.0, 'related': ['Poetry', 'Drama', 'Art']},
        'Poetry': {'weight': 1.0, 'related': ['Fiction', 'Art', 'Drama']},
        'Art': {'weight': 0.8, 'related': ['Poetry', 'Photography', 'Design']}
    }
}

def get_genre_distribution(library):
    logging.info("Calculating genre distribution")
    total_books = len(library)
    genre_counts = Counter()
    genre_co_occurrence = defaultdict(int)
    
    for book in library:
        if book.get('categories'):
            # Handle both string and list formats
            if isinstance(book['categories'], str):
                genres = [g.strip() for g in book['categories'].split(',')]
            elif isinstance(book['categories'], list):
                genres = [g.strip() for g in book['categories']]
            else:
                logging.warning(f"Unexpected categories format: {type(book['categories'])}")
                continue
            
            # Update genre counts
            genre_counts.update(genres)
            
            # Update co-occurrence matrix
            for genre1, genre2 in combinations(genres, 2):
                genre_co_occurrence[(genre1, genre2)] += 1
                genre_co_occurrence[(genre2, genre1)] += 1
    
    # Calculate genre distribution percentages
    genre_distribution = {
        genre: (count / total_books) * 100 
        for genre, count in genre_counts.items()
    }
    
    # Calculate genre relationships
    genre_relationships = {}
    for (genre1, genre2), count in genre_co_occurrence.items():
        if genre1 not in genre_relationships:
            genre_relationships[genre1] = {}
        genre_relationships[genre1][genre2] = count / genre_counts[genre1]
    
    logging.info(f"Found {len(genre_distribution)} unique genres")
    return genre_distribution, genre_relationships

def create_feature_vector(genre_distribution, archetype_weights):
    logging.info("Creating feature vector for clustering")
    # Create a standardized feature vector combining genre distribution and archetype weights
    features = []
    
    # Add genre distribution
    for genre, weight in archetype_weights.items():
        features.append(genre_distribution.get(genre, 0))
    
    # Add archetype weights
    for archetype, weights in archetype_weights.items():
        features.extend(list(weights.values()))
    
    return np.array(features).reshape(1, -1)

def enhanced_clustering(genre_distribution, archetype_weights):
    logging.info("Performing enhanced clustering analysis")
    
    # Create feature vector
    features = create_feature_vector(genre_distribution, archetype_weights)
    
    # Standardize features
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)
    
    # Initialize clustering models
    kmeans = KMeans(n_clusters=6, random_state=42)
    gmm = GaussianMixture(n_components=6, random_state=42)
    hierarchical = AgglomerativeClustering(n_clusters=6)
    
    # Perform clustering
    try:
        kmeans_labels = kmeans.fit_predict(features_scaled)
        gmm_labels = gmm.fit_predict(features_scaled)
        hierarchical_labels = hierarchical.fit_predict(features_scaled)
        
        # Get cluster probabilities from GMM
        gmm_probs = gmm.predict_proba(features_scaled)
        
        # Combine results
        cluster_results = {
            'kmeans': kmeans_labels[0],
            'gmm': gmm_labels[0],
            'hierarchical': hierarchical_labels[0],
            'gmm_probabilities': gmm_probs[0]
        }
        
        logging.info(f"Clustering results: {cluster_results}")
        return cluster_results
        
    except Exception as e:
        logging.error(f"Error in clustering: {str(e)}")
        return None

def calculate_archetype_scores(genre_distribution, genre_relationships):
    logging.info("Calculating archetype scores")
    scores = {}
    for archetype, genre_configs in archetype_weights.items():
        score = 0
        total_weight = 0
        
        # Calculate primary genre scores
        for genre, config in genre_configs.items():
            if genre in genre_distribution:
                primary_score = (genre_distribution[genre] / 100) * config['weight']
                score += primary_score
                total_weight += config['weight']
                
                # Add bonus for related genres
                for related_genre in config['related']:
                    if related_genre in genre_distribution:
                        # Check if there's a strong relationship between the genres
                        relationship_strength = genre_relationships.get(genre, {}).get(related_genre, 0)
                        related_score = (genre_distribution[related_genre] / 100) * config['weight'] * 0.5 * relationship_strength
                        score += related_score
        
        scores[archetype] = score / total_weight if total_weight > 0 else 0
    
    return scores, archetype_weights

def calculate_confidence(scores, genre_distribution, genre_relationships):
    logging.info("Calculating confidence scores")
    confidences = {}
    
    for archetype, score in scores.items():
        # Base confidence on the score itself
        base_confidence = score
        
        # Calculate genre diversity factor
        relevant_genres = [genre for genre in genre_distribution.keys() 
                         if any(genre in config['related'] for config in archetype_weights[archetype].values())]
        genre_diversity = len(relevant_genres) / len(genre_distribution) if genre_distribution else 0
        
        # Calculate relationship strength
        relationship_strength = 0
        for genre1 in relevant_genres:
            for genre2 in relevant_genres:
                if genre1 != genre2:
                    relationship_strength += genre_relationships.get(genre1, {}).get(genre2, 0)
        relationship_strength = relationship_strength / (len(relevant_genres) * (len(relevant_genres) - 1)) if len(relevant_genres) > 1 else 0
        
        # Combine factors
        confidence = (base_confidence * 0.5 + 
                     genre_diversity * 0.3 + 
                     relationship_strength * 0.2)
        
        confidences[archetype] = min(1.0, confidence)
    
    return confidences

def determine_primary_archetype(scores, cluster_results):
    logging.info("Determining primary archetype")
    if not cluster_results:
        # Fallback to simple score-based determination
        return max(scores.items(), key=lambda x: x[1])
    
    # Get the most confident prediction from GMM
    gmm_probs = cluster_results['gmm_probabilities']
    most_confident_cluster = np.argmax(gmm_probs)
    confidence = gmm_probs[most_confident_cluster]
    
    # Map cluster to archetype
    archetype_mapping = {
        0: 'Scholar',
        1: 'Knight',
        2: 'Explorer',
        3: 'Romantic',
        4: 'Sage',
        5: 'Artist'
    }
    
    # Get the archetype from the most confident cluster
    primary_archetype = archetype_mapping[most_confident_cluster]
    
    # Verify with other clustering methods
    kmeans_archetype = archetype_mapping[cluster_results['kmeans']]
    hierarchical_archetype = archetype_mapping[cluster_results['hierarchical']]
    
    # If all methods agree, increase confidence
    if kmeans_archetype == hierarchical_archetype == primary_archetype:
        confidence = min(1.0, confidence * 1.2)
    
    return primary_archetype, confidence

def analyze_library(library):
    logging.info("Starting library analysis")
    try:
        # Get genre distribution and relationships
        genre_distribution, genre_relationships = get_genre_distribution(library)
        
        # Calculate archetype scores
        scores, archetype_weights = calculate_archetype_scores(genre_distribution, genre_relationships)
        
        # Calculate confidence scores
        confidences = calculate_confidence(scores, genre_distribution, genre_relationships)
        
        # Determine primary archetype
        primary_archetype = max(scores.items(), key=lambda x: x[1])[0]
        primary_confidence = confidences[primary_archetype]
        
        # Get archetype description
        archetype_descriptions = {
            'Scholar': 'A reader who enjoys academic and intellectual pursuits, focusing on knowledge and learning.',
            'Knight': 'A reader who enjoys adventure, fantasy, and heroic narratives.',
            'Explorer': 'A reader who seeks to discover new worlds, ideas, and perspectives.',
            'Romantic': 'A reader who enjoys emotional stories, relationships, and character-driven narratives.',
            'Sage': 'A reader who seeks wisdom and personal growth through their reading.',
            'Artist': 'A reader who appreciates creative expression and aesthetic beauty in literature.'
        }
        
        return {
            'success': True,
            'archetype': {
                'name': primary_archetype,
                'description': archetype_descriptions[primary_archetype],
                'confidence': primary_confidence,
                'genreDistribution': genre_distribution,
                'scores': scores,
                'archetypeConfidences': confidences,
                'archetypeWeights': archetype_weights
            }
        }
        
    except Exception as e:
        logging.error(f"Error in library analysis: {str(e)}")
        return {
            'success': False,
            'message': str(e)
        }

def main():
    logging.info("Starting archetype analysis script")
    try:
        # Read library data from command line arguments
        logging.info("Reading library data from command line arguments")
        if len(sys.argv) < 2:
            logging.error("No library data provided as command line argument")
            print(json.dumps({
                'success': False,
                'message': 'No library data provided'
            }))
            return
            
        library_data = sys.argv[1]
        logging.info(f"Received {len(library_data)} bytes from command line")
        
        try:
            library = json.loads(library_data)
            logging.info(f"Successfully loaded library with {len(library)} books")
        except json.JSONDecodeError as e:
            logging.error(f"Failed to parse JSON data: {str(e)}")
            logging.debug(f"Raw data received: {library_data[:200]}...")  
            print(json.dumps({
                'success': False,
                'message': f'Invalid JSON data received: {str(e)}'
            }))
            return
        
        # Analyze the library
        result = analyze_library(library)
        
        # Output the result as JSON
        logging.info("Analysis complete, outputting results")
        print(json.dumps(result))
        
    except Exception as e:
        logging.error(f"Unexpected error: {str(e)}", exc_info=True)
        print(json.dumps({
            'success': False,
            'message': f'Error processing request: {str(e)}'
        }))

if __name__ == '__main__':
    main() 