document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('query');
    if (query) {
        fetchBooks(query);
    }
   // MutationObserver to watch for changes and add id and name attributes
   const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.matches('input.swv-input')) {
                if (!node.id) {
                    node.id = 'swv-input';
                }
                if (!node.name) {
                    node.name = 'swv-input';
                }
            }
        });
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
});

function fetchBooks(query) {
    var apiUrl = `https://www.googleapis.com/books/v1/volumes?q=intitle:${query}`;

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
                        var categories = book.categories ? book.categories.join(', ') : 'Unknown';  // Get categories
                        var bookItem = document.createElement('div');
                        bookItem.classList.add('bg-white', 'rounded', 'shadow', 'p-4', 'flex', 'items-start', 'cursor-pointer');
                        bookItem.innerHTML = `
                            <a href="../html/book.html?isbn=${isbn}" class="block w-full">
                                <div class="bg-white rounded shadow p-4 flex items-start hover:bg-gray-200 transition duration-300">
                                    <img src="${thumbnail}" alt="${book.title}" class="w-32 h-48 mr-4">
                                    <div>
                                        <h2 class="text-xl font-bold mb-2">${book.title}</h2>
                                        <p class="text-gray-700 mb-2">by ${book.authors ? book.authors.join(', ') : 'Unknown'}</p>
                                        <p class="text-gray-700 mb-2"><strong>Categories:</strong> ${categories}</p>
                                        <p class="text-gray-600 mb-4">${book.description ? book.description : 'No description available'}</p>
                                    </div>
                                </div>
                            </a>
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
    const modal = document.getElementById('myModal');
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
   console.log('Google Books API loaded successfully.');
});

