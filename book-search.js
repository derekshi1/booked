// Book search for the search box and results page.
//
// Google returns every edition it has (a search for "the great gatsby" is 12
// Gatsbys), plus summaries, study guides and unrelated matches. This combines
// Google (good edition details), OpenLibrary (one result per work, plus how many
// people read it) and our catalog; keeps English books; drops knock-offs; groups
// editions of the same book; shows the best edition of each; and ranks books by
// how well they match the search and how popular they are.
const mongoose = require('mongoose');
const { searchBooks } = require('./google-books');

const MAX_RESULTS = 15;
const MIN_RELEVANCE = 0.25; // below this a result has little to do with the search

// Not the book itself: summaries, guides and other spin-offs
const KNOCKOFF = /\b(summary|summaries|study guide|sparknotes|cliffsnotes|workbook|analysis of|critical companion|companion to|guide to|trivia|quiz|unofficial|coloring|colouring|literature guide|teacher'?s guide|lesson plans?|essays on|critical essays|criticism|casebook|notes on|reader'?s guide|maxnotes|journal|planner|notebook)\b/i;
// A publisher or summary mill in the author field ("University Press", "Readtrepreneur Publishing")
const PUBLISHER_AS_AUTHOR = /\b(press|publishing|publications|publishers|editorial|books llc|summar\w*|readtrepreneur)\b/i;
// Titles in Cyrillic, CJK and other non-Latin scripts (e.g. bilingual editions labeled English)
const NON_LATIN = /[^\u0000-\u024F\u1E00-\u1EFF\u2000-\u206F\u20A0-\u20CF\u2100-\u214F]/;
// Summaries whose title doesn't say so, but whose description does
const KNOCKOFF_DESCRIPTION = /\b(this summary|a summary of|short summary|book summary|key takeaways|summary and analysis|chapter-by-chapter summary|shortened version|independent addition|not the original book|seminar paper|term paper|bachelor thesis|master'?s thesis|platforms:|contains essays|essays about|critical views)/i;
// Marketing copy instead of a description, common on reprint editions
const BOILERPLATE = /why buy our paperbacks|most popular gift edition|this book is a reproduction|public domain|we are delighted to publish|scanned from|first published in \d{4}, this/i;
// Words that mark one edition rather than the book
const EDITION_WORDS = /\b(\d+(st|nd|rd|th)|illustrated|annotated|unabridged|abridged|deluxe|hardbound|hardcover|paperback|edition|classics?|movie tie-in|tie-in|netflix|anniversary|authentic|original|complete|collector'?s|special|novel|a novel|reader'?s library|modern|penguin|vintage|signet|bantam)\b/gi;

const normalize = (text) => (text || '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// First initial + last name, so "F. Scott Fitzgerald" and "Francis Scott Fitzgerald" match,
// but Frank and Brian Herbert's Dune books stay apart. With several authors, the
// alphabetically first, so co-authors listed in a different order still match.
const HONORIFICS = /^(president|dr|sir|dame|rev|lord|lady|mr|mrs|ms)\s+/;
const nameKey = (name) => {
  const words = normalize((name || '').replace(/['’]s\b/gi, '')).replace(HONORIFICS, '').split(' ').filter(Boolean);
  return words.length ? `${words[0][0]} ${words[words.length - 1]}` : '';
};
const authorKey = (authors) => {
  const keys = (Array.isArray(authors) ? authors : [authors]).map(nameKey).filter(Boolean).sort();
  return keys[0] || '';
};

// "F. Scott Fitzgerald: The Great Gatsby (Illustrated)" -> "great gatsby"
function workTitle(title, authors) {
  // Brackets hold edition notes; " / " starts series or edition junk
  let text = (title || '').replace(/\[[^\]]*\]|\([^)]*\)/g, ' ').split(' / ')[0];
  const lastName = authorKey(authors).split(' ').pop();
  // "Jane Austen: Pride and Prejudice" puts the author first
  const colon = text.indexOf(':');
  if (colon > 0 && lastName && normalize(text.slice(0, colon)).includes(lastName)) text = text.slice(colon + 1);
  else if (colon > 0) {
    // Drop descriptive subtitles ("Sapiens: A Brief History of Humankind", "...: A Novel") and
    // edition notes, but keep ones that name a different book ("Dune: House Atreides")
    const subtitle = text.slice(colon + 1).trim();
    if (/^(a|an)\s/i.test(subtitle) || new RegExp(EDITION_WORDS.source, 'i').test(subtitle)) text = text.slice(0, colon);
  }
  text = text.replace(/\bby(\s+[a-z .]+)?$/i, ' ');
  return normalize(text.replace(EDITION_WORDS, ' ')).replace(/^(the|a|an) /, '');
}

// How well a book matches the search, 0-1
function relevance(query, title, authors) {
  const q = normalize(query).replace(/^(the|a|an) /, '');
  const t = workTitle(title, authors);
  if (!q) return 0;
  if (t === q) return 1;
  if (t.startsWith(q) || q.startsWith(t)) return 0.8;
  const authorNames = (Array.isArray(authors) ? authors : [authors]).map(normalize).join(' ');
  if (authorNames.includes(q)) return 0.75;
  const queryWords = q.split(' ');
  const titleWords = new Set(t.split(' '));
  const overlap = queryWords.filter(w => titleWords.has(w)).length / queryWords.length;
  return overlap * 0.6;
}

const fromGoogle = (item, position) => {
  const info = item.volumeInfo || {};
  return {
    title: info.title,
    authors: info.authors || [],
    thumbnail: info.imageLinks?.thumbnail,
    isbn: info.industryIdentifiers?.[0]?.identifier, // real ISBNs are listed first
    description: info.description || '',
    language: info.language,
    ratingsCount: info.ratingsCount || 0,
    categories: info.categories || [],
    pageCount: info.pageCount,
    position,
    source: 'google',
  };
};

// OpenLibrary is occasionally slow, so cache its answers; search still works without them
const OPENLIBRARY_TIMEOUT_MS = 7000;
const OPENLIBRARY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const OPENLIBRARY_CACHE_SIZE = 500;
const openLibraryCache = new Map(); // normalized query -> { docs, expires }

const fromOpenLibrary = (doc, position) => {
  const isbns = doc.isbn || [];
  return {
    title: doc.title,
    authors: doc.author_name || [],
    thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
    isbn: isbns.find(i => /^97[89]\d{10}$/.test(i)) || isbns[0],
    isbns,
    description: '',
    language: !doc.language || doc.language.includes('eng') ? 'en' : doc.language[0],
    ratingsCount: doc.ratings_count || 0,
    readers: doc.readinglog_count || 0,
    editionCount: doc.edition_count || 0,
    // OpenLibrary tags books about a book ("Criticism and interpretation", "Study guides").
    // Famous books carry hundreds of tags, including those, so only trust it for little-read ones.
    isAboutABook: (doc.readinglog_count || 0) < 300
      && (doc.subject || []).some(subject => /criticism|interpretation|study guides|examinations|outlines, syllabi/i.test(subject)),
    position,
    source: 'openlibrary',
  };
};

async function openLibraryWorks(query) {
  const key = normalize(query);
  const cached = openLibraryCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.docs;

  const params = new URLSearchParams({
    q: query,
    limit: '15',
    fields: 'title,author_name,isbn,cover_i,readinglog_count,ratings_count,edition_count,language,subject',
  });
  const response = await fetch(`https://openlibrary.org/search.json?${params}`, {
    signal: AbortSignal.timeout(OPENLIBRARY_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`OpenLibrary search returned ${response.status}`);
  const docs = (await response.json()).docs || [];
  if (openLibraryCache.size >= OPENLIBRARY_CACHE_SIZE) openLibraryCache.delete(openLibraryCache.keys().next().value);
  openLibraryCache.set(key, { docs, expires: Date.now() + OPENLIBRARY_CACHE_TTL_MS });
  return docs;
}

const fromCatalog = (doc) => ({
  title: doc.title,
  authors: doc.authors || [],
  thumbnail: doc.thumbnail,
  isbn: doc.isbn,
  description: doc.description || '',
  language: 'en',
  ratingsCount: doc.ratingsCount || 0,
  categories: doc.categories || [],
  pageCount: doc.pageCount,
  bestsellerWeeks: doc.bestsellerWeeks || 0,
  inLibraries: doc.inLibraries || 0,
  position: 20,
  source: 'catalog',
});

// Which edition of a book to show: one Booked readers or bestseller lists know, then the most complete one
function editionScore(book) {
  const description = book.description || '';
  // OpenLibrary counts cover the whole work, so they'd outweigh any one edition's; and
  // its results have no description, so prefer a Google or catalog edition when there is one
  let score = (book.source === 'openlibrary' ? -2 : Math.log1p(book.ratingsCount))
    + (book.source === 'catalog' ? 1 : 0)
    + Math.min(book.inLibraries || 0, 3)
    + (book.bestsellerWeeks ? 1.5 : 0);
  // Reprint-style titles: "Pride and Prejudice by Jane Austen", "... / World Literature Classics"
  const lastName = authorKey(book.authors).split(' ').pop();
  if (/\s\/\s/.test(book.title) || (lastName && normalize(book.title).includes(lastName))) score -= 1;
  if (/^[A-Z0-9 !'’,.-]{20,}/.test(description)) score -= 0.5; // a shouty all-caps blurb
  if (description.length > 80 && !BOILERPLATE.test(description)) score += 3;
  if (book.categories?.length) score += 0.3;
  if (book.pageCount) score += 0.2;
  if (/^97[89]\d{10}$/.test(book.isbn || '')) score += 0.2;
  if ((book.title || '').replace(EDITION_WORDS, '').length < (book.title || '').length) score -= 1;
  return score - book.position * 0.02;
}

async function catalogMatches(query) {
  const db = mongoose.connection.db;
  const words = normalize(query).split(' ').filter(w => w.length > 2);
  if (!db || !words.length) return [];
  // Every word of the search has to appear in the title or an author's name
  const conditions = words.map(word => ({
    $or: [{ title: { $regex: word, $options: 'i' } }, { authors: { $regex: word, $options: 'i' } }],
  }));
  return db.collection('catalogbooks')
    .find({ $and: conditions, isbn: { $ne: null } }, { projection: { embedding: 0, embeddingTextHash: 0 } })
    .limit(20)
    .toArray();
}

async function searchBookResults(query) {
  const [google, openLibrary, catalog] = await Promise.all([
    searchBooks({ q: query, maxResults: 40, langRestrict: 'en', printType: 'books' }).catch(error => {
      console.error('Book search failed:', error.message);
      return {};
    }),
    openLibraryWorks(query).catch(error => {
      console.error('OpenLibrary search failed:', error.message);
      return [];
    }),
    catalogMatches(query).catch(error => {
      console.error('Catalog search failed:', error.message);
      return [];
    }),
  ]);

  const candidates = [
    ...(google.items || []).map(fromGoogle),
    ...openLibrary.map(fromOpenLibrary),
    ...catalog.map(fromCatalog),
  ].filter(book =>
    book.title && book.isbn && book.thumbnail
    && (!book.language || book.language === 'en')
    && !NON_LATIN.test(book.title)
    && !book.isAboutABook
    && !KNOCKOFF.test(book.title)
    && !(book.authors || []).some(author => PUBLISHER_AS_AUTHOR.test(author))
    && !KNOCKOFF_DESCRIPTION.test((book.description || '').slice(0, 400)));

  // Group editions of the same book. OpenLibrary lists every ISBN a work has, which also
  // joins editions with different titles ("1984" and "Nineteen Eighty-Four").
  const workByIsbn = new Map();
  for (const book of candidates.filter(b => b.source === 'openlibrary')) {
    const key = `${workTitle(book.title, book.authors)}|${authorKey(book.authors)}`;
    for (const isbn of book.isbns) if (!workByIsbn.has(isbn)) workByIsbn.set(isbn, key);
  }
  const works = new Map();
  for (const book of candidates) {
    const key = workByIsbn.get(book.isbn) || `${workTitle(book.title, book.authors)}|${authorKey(book.authors)}`;
    if (!works.has(key)) works.set(key, []);
    works.get(key).push(book);
  }

  const ranked = [...works.values()].map(editions => {
    const best = editions.reduce((a, b) => (editionScore(b) > editionScore(a) ? b : a));
    const ratings = editions.reduce((sum, e) => sum + e.ratingsCount, 0);
    const readers = Math.max(...editions.map(e => e.readers || 0));
    const editionCount = Math.max(editions.length, ...editions.map(e => e.editionCount || 0));
    const popularity = Math.log1p(ratings) / Math.log1p(500)
      + Math.log1p(readers) / Math.log1p(10000) // OpenLibrary readers: the clearest popularity signal
      + Math.min(Math.log1p(editionCount) / Math.log1p(200), 1) * 0.5 // lots of editions = a well-known book
      + (editions.some(e => e.bestsellerWeeks) ? 0.3 : 0)
      + Math.min(Math.max(...editions.map(e => e.inLibraries || 0)), 3) * 0.1;
    const topPosition = Math.min(...editions.map(e => e.position));
    const workKey = `${workTitle(best.title, best.authors)}|${authorKey(best.authors)}`;
    let match = Math.max(...editions.map(e => relevance(query, e.title, e.authors)));
    // OpenLibrary's top hits are reliable even when worded differently ("1984" vs "Nineteen Eighty-Four")
    const openLibraryHit = editions.find(e => e.source === 'openlibrary' && e.position < 3 && e.readers >= 500);
    if (openLibraryHit) match = Math.max(match, 0.9 - openLibraryHit.position * 0.1);
    return { best, match, readers, workKey, score: 2 * match + popularity - topPosition * 0.01 };
  });

  const sorted = ranked.filter(({ match }) => match >= MIN_RELEVANCE).sort((a, b) => b.score - a.score);
  // Same title as the top result but another author and a sliver of its readers: a study,
  // adaptation or knock-off of that book ("The Great Gatsby" by a literary critic)
  const top = sorted[0];
  const [topTitle, topAuthor] = top ? top.workKey.split('|') : [];
  const shadowsTop = (work) => top && work !== top && top.readers >= 1000
    && work.workKey.split('|')[0].includes(topTitle)
    && work.workKey.split('|')[1] !== topAuthor
    && work.readers < top.readers * 0.05;

  return sorted
    .filter(work => !shadowsTop(work))
    .slice(0, MAX_RESULTS)
    .map(({ best }) => ({
      type: 'book',
      title: best.title,
      authors: best.authors.length ? best.authors : ['Unknown'],
      thumbnail: best.thumbnail,
      isbn: best.isbn,
      description: best.description,
    }));
}

module.exports = { searchBookResults, workTitle };
