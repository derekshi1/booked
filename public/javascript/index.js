google.books.load();

function alertNotFound() {
    alert("Could not embed the book!");
}

function initialize(isbn) {
    var viewer = new google.books.DefaultViewer(document.getElementById('viewerCanvas'));
    viewer.load('ISBN:' + isbn, alertNotFound);
}

google.books.setOnLoadCallback(function() {
    // Initialize with a default ISBN
    initialize('9780062316097'); // Sapiens: A Brief History of Humankind
});

function loadBook(isbn) {
    if (isbn) {
        console.log('Loading book with ISBN:', isbn);
        initialize(isbn);
        document.getElementById('myModal').classList.remove('hidden');
        document.getElementById('myModal').classList.add('flex');
    } else {
        alert('ISBN not found.');
    }
}

function searchBookByTitle() {
    var title = document.getElementById('titleInput').value;
    var apiUrl = `https://www.googleapis.com/books/v1/volumes?q=intitle:${title}`;

    fetch(apiUrl)
        .then(response => response.json())
        .then(data => {
            var resultsDiv = document.getElementById('results');
            resultsDiv.innerHTML = '';  // Clear previous results
            if (data.totalItems > 0) {
                data.items.forEach((item, index) => {
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
                                <button onclick="loadBook('${isbn}')" class="bg-green-700 text-white px-4 py-2 rounded">Preview</button>
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
