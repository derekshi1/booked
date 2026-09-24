// Google Books search with a server-side cache and an OpenLibrary fallback.
// Google allows 1,000 queries/day on the free quota; the cache keeps repeat
// searches off that quota, and the fallback keeps search working once it's used up.

const GOOGLE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// Fallback results are cached briefly so Google results come back once the quota resets
const FALLBACK_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1000;
const REQUEST_TIMEOUT_MS = 10 * 1000;

const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function cacheSet(key, data, ttlMs) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    // Maps iterate in insertion order, so this drops the oldest entry
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { data, expires: Date.now() + ttlMs });
}

// Turn a Google query ("isbn:123", 'subject:"x"', "intitle:y", free text) into OpenLibrary params
function toOpenLibraryParams(googleQuery, limit) {
  const params = new URLSearchParams({
    limit: String(limit),
    fields: 'title,author_name,isbn,cover_i,first_publish_year,subject,number_of_pages_median,first_sentence',
  });
  const match = googleQuery.match(/^\s*(isbn|intitle|inauthor|subject):\s*"?([^"]+?)"?\s*$/i);
  const field = { isbn: 'isbn', intitle: 'title', inauthor: 'author', subject: 'subject' }[match?.[1].toLowerCase()];
  if (field) {
    params.set(field, match[2]);
  } else {
    // Drop Google operators (subject:, OR, quotes) and search the remaining words
    params.set('q', googleQuery.replace(/\b\w+:/g, ' ').replace(/\bOR\b|"/g, ' ').replace(/\s+/g, ' ').trim());
  }
  return params;
}

// Reshape an OpenLibrary search result into Google's volume format so callers don't change
function toGoogleVolume(doc, preferredIsbn) {
  const isbns = doc.isbn || [];
  const isbn = isbns.find(i => i === preferredIsbn) || isbns.find(i => i.length === 13) || isbns[0];
  const firstSentence = Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : doc.first_sentence;
  return {
    kind: 'books#volume',
    volumeInfo: {
      title: doc.title,
      authors: doc.author_name,
      publishedDate: doc.first_publish_year ? String(doc.first_publish_year) : undefined,
      description: firstSentence,
      categories: doc.subject?.slice(0, 3),
      pageCount: doc.number_of_pages_median,
      industryIdentifiers: isbn ? [{ type: isbn.length === 13 ? 'ISBN_13' : 'ISBN_10', identifier: isbn }] : [],
      imageLinks: doc.cover_i ? {
        thumbnail: `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`,
        smallThumbnail: `https://covers.openlibrary.org/b/id/${doc.cover_i}-S.jpg`,
      } : undefined,
    },
  };
}

async function searchOpenLibrary(googleQuery, limit) {
  const params = toOpenLibraryParams(googleQuery, limit);
  const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`OpenLibrary search failed with ${response.status}`);
  const data = await response.json();
  const docs = data.docs || [];
  return {
    kind: 'books#volumes',
    totalItems: docs.length,
    items: docs.map(doc => toGoogleVolume(doc, params.get('isbn'))),
    source: 'openlibrary',
  };
}

// `params` are Google Books volume query params (q, maxResults, orderBy, ...), without the key.
// Resolves to a Google-style { items: [...] } response.
async function searchBooks(params) {
  const query = new URLSearchParams(params);
  query.delete('key');
  query.sort();
  const cacheKey = query.toString();

  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://www.googleapis.com/books/v1/volumes?${query}&key=${process.env.API_KEY}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (response.ok) {
      const data = await response.json();
      cacheSet(cacheKey, data, GOOGLE_CACHE_TTL_MS);
      return data;
    }
    console.error(`Google Books returned ${response.status}; falling back to OpenLibrary`);
  } catch (error) {
    console.error('Google Books request failed; falling back to OpenLibrary:', error.message);
  }

  const limit = Math.min(parseInt(query.get('maxResults'), 10) || 10, 40);
  const data = await searchOpenLibrary(query.get('q') || '', limit);
  cacheSet(cacheKey, data, FALLBACK_CACHE_TTL_MS);
  return data;
}

module.exports = { searchBooks };
