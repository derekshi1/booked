# Booked

**Booked** is a cutting-edge application designed for book lovers who want personalized book recommendations, a platform to connect with fellow readers, and a clean, engaging space to fulfill all their book-related needs.

## Features

- **Personalized Book Recommendations**: Leveraging advanced vector search technology, Booked provides you with book recommendations that perfectly match your reading preferences.
  
- **Connect with Other Readers**: Join a community of like-minded individuals who share your love for books. Discuss your favorite reads, share recommendations, and make new friends.

- **Clean and Intuitive Interface**: Enjoy a user-friendly experience with a clean and organized space that makes finding, reading, and discussing books a pleasure.

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- Google Books API key

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. All API keys are read on the server only; the browser reaches Google Books and NYT through `/api/google-books/*` and `/api/nyt/*`. Never put keys in `public/`, since everything there is served to visitors.

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/booked.git
cd booked
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
- Copy `.env.example` to `.env`
- Fill in your environment variables

4. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## Deployment (Google Cloud Run)

The app (Express + the Python scripts in `functions/`) ships as one Docker image. Cloud Run's free tier covers low traffic; give it 2 GiB of memory because the recommendation scripts load a sentence-transformers model.

```bash
gcloud run deploy booked --source . --region us-central1 --memory 2Gi --allow-unauthenticated \
  --set-env-vars "MONGODB_URI=...,API_KEY=...,NYT_API_KEY=...,PINECONE_KEY=...,GOOGLE_AUTH_CLIENT_SECRET=...,hf_api_key=..."
```

After the first deploy, add the Cloud Run URL to the OAuth client's Authorized JavaScript origins in Google Cloud Console so Google sign-in works.

To run the same image locally: `docker compose up --build`, then open http://localhost:8080.

## Recommendations

Recommendations are a vector search over a precomputed book catalog (the `catalogbooks` collection):

- `functions/catalog.py` collects books from users' libraries, NYT bestseller lists and Google Books by subject, merges editions, and embeds each book once. Run `python functions/catalog.py --google 250 --nyt-weeks 26` for an initial build; a Cloud Scheduler job calls `POST /api/admin/refresh-catalog` every 4 hours (with the `X-Refresh-Token` header set to `CATALOG_REFRESH_TOKEN`) to add more books using 20 Google queries; each run stops after 4 minutes and leaves any remaining embeddings for the next one.
- `functions/recommender.py` builds a reader's taste from their books weighted by rating (split into clusters so different tastes aren't averaged together), then ranks the catalog in memory. It powers regular, opposite and "books like this" recommendations.
- `python functions/evaluate_recs.py` hides some of each reader's highly rated books and reports how often they're recommended back, compared with popular and random picks.

## Project Structure
├── public/ # Static files and client-side code  
│ ├── html/ # HTML pages  
│ ├── javascript/ # Client-side JavaScript  
│ └── css/ # Stylesheets  
├── functions/ # Python recommendation scripts (not publicly served)  
├── server.js # Main server file  
├── package.json # Project dependencies  
└── .env # Environment variables  

##Contact
For comments, concerns, or support please feel free to contact derekscreek@gmail.com
