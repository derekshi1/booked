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

Create a `.env` file in the root directory with the following variables:

```env
MONGODB_URI= mongodb_connection_string
API_KEY= google_books_api_key
```

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

## Project Structure
├── public/ # Static files and client-side code  
│ ├── html/ # HTML pages  
│ ├── javascript/ # Client-side JavaScript  
│ └── css/ # Stylesheets  
├── server.js # Main server file  
├── package.json # Project dependencies  
└── .env # Environment variables  

##Contact
For comments, concerns, or support please feel free to contact derekscreek@gmail.com
