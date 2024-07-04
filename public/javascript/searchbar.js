// Search bar functionality
function expandSearch() {
    const searchInput = document.getElementById('titleInput');
    const closeIcon = document.querySelector('.close-icon');
    searchInput.classList.add('expanded');
    closeIcon.classList.add('visible');
    searchInput.focus();
}

function collapseSearch() {
    const searchInput = document.getElementById('titleInput');
    const closeIcon = document.querySelector('.close-icon');
    searchInput.classList.remove('expanded');
    closeIcon.classList.remove('visible');
    searchInput.value = '';  // Clear the input field
}

function handleSearch(event) {
    if (event.key === 'Enter') {
        searchBookByTitle();
        event.preventDefault();
    }
}

// Search functionality
function searchBookByTitle() {
    var title = document.getElementById('titleInput').value;
    var apiUrl = `https://www.googleapis.com/books/v1/volumes?q=intitle:${title}`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            var resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = '';  // Clear previous results
            if (data.totalItems > 0) {
                data.items.forEach((item) => {
                    var book = item.volumeInfo;
                    if (book.previewLink) {  // Ensure the book has a preview
                        var isbn = getISBN(book.industryIdentifiers);
                        var thumbnail = book.imageLinks ? book.imageLinks.thumbnail : 'https://via.placeholder.com/128x192?text=No+Image';
                        var bookItem = document.createElement('div');
                        bookItem.classList.add('bg-white', 'rounded', 'shadow', 'p-4', 'flex', 'items-start');
                        bookItem.innerHTML = `
                            <img src="${thumbnail}" alt="${book.title}" class="w-32 h-48 mr-4">
                            <div>
                                <h2 class="text-xl font-bold mb-2">${book.title}</h2>
                                <p class="text-gray-700 mb-2">by ${book.authors ? book.authors.join(', ') : 'Unknown'}</p>
                                <p class="text-gray-600 mb-4">${book.description ? book.description : 'No description available'}</p>
                                <div class="flex space-x-2">
                                    <button onclick="loadBook('${isbn}')" class="bg-green-700 text-white px-4 py-2 rounded">Preview</button>
                                    <button onclick="addToLibrary('${isbn}')" class="bg-blue-500 text-white px-4 py-2 rounded">Add to Library</button>
                                </div>
                            </div>
                        `;
                        resultsDiv.appendChild(bookItem);
                    }
                });
            } else {
                resultsDiv.innerHTML = '<p>No books found for the given title.</p>';
            }
        })
        .catch(error => {
            console.error('Error fetching book data:', error);
            alert('Error fetching book data.');
        });
}

function getISBN(identifiers) {
    if (!identifiers) return null;
    for (var i = 0; i < identifiers.length; i++) {
        if (identifiers[i].type === 'ISBN_13') {
            return identifiers[i].identifier;
        }
    }
    return null;
}

// Modal handling
function loadBook(isbn) {
    if (isbn) {
        initialize(isbn);
        document.getElementById('myModal').classList.remove('hidden');
        document.getElementById('myModal').classList.add('flex');
    } else {
        alert('ISBN not found.');
    }
}

function closeModal() {
    document.getElementById('myModal').classList.add('hidden');
    document.getElementById('myModal').classList.remove('flex');
}

window.onclick = function(event) {
    var modal = document.getElementById('myModal');
    if (event.target == modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

// Initialize Google Books API
google.books.load();

function alertNotFound() {
    alert("Could not embed the book!");
}

function initialize(isbn) {
    var viewerCanvas = document.getElementById('viewerCanvas');
    
    if (viewerCanvas) {
        var viewer = new google.books.DefaultViewer(viewerCanvas);
        viewer.load('ISBN:' + isbn, alertNotFound);
    }
}

google.books.setOnLoadCallback(function() {
    // Initialize with a default ISBN
    console.log('Google Books API loaded successfully.');
});

// Add to Library
function addToLibrary(isbn) {
    const username = localStorage.getItem('username');
    if (!username) {
        alert('You need to be logged in to add books to your library.');
        return;
    }

    fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
        .then(response => response.json())
        .then(data => {
            const book = data.items[0].volumeInfo;
            const bookData = {
                username,
                isbn,
                title: book.title,
                authors: book.authors ? book.authors.join(', ') : 'Unknown',
                description: book.description ? book.description : 'No description available',
                thumbnail: book.imageLinks ? book.imageLinks.thumbnail : 'https://via.placeholder.com/128x192?text=No+Image'
            };

            fetch('/api/library/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookData),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Book added to your library!');
                } else {
                    alert('Failed to add book to library: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error adding book to library:', error);
                alert('Error adding book to library.');
            });
        })
        .catch(error => {
            console.error('Error fetching book data:', error);
            alert('Error fetching book data.');
        });
}
