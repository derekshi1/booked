document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    const userSection = document.getElementById('userSection');

    userSection.innerHTML = `
        <div class="search-container relative">
            <img src="https://cdn-icons-png.flaticon.com/512/54/54481.png" alt="Search" class="search-icon w-6 h-6" onclick="expandSearch()">
            <input type="text" id="titleInput" placeholder="Search for books" class="search-input" onblur="collapseSearch()" onkeydown="handleSearch(event)">
            <img src="https://cdn-icons-png.flaticon.com/512/1828/1828778.png" alt="Close" class="close-icon w-6 h-6" onclick="collapseSearch()">
            <div id="suggestionsBox" class="suggestions"></div> <!-- Suggestions Box -->
        </div>
        <a href="../html/library.html" class="ml-4 bg-green-900 text-white px-4 py-2 rounded">Library</a>
    `;

    if (username) {
        userSection.innerHTML += `
            <div class="flex flex-col items-center">
                <img src="../profile.png" alt="Profile" class="w-6 h-6 mb-1 cursor-pointer" onclick="window.location.href='../html/profile.html'">
                <span class="handwriting-font cursor-pointer" onclick="window.location.href='../html/profile.html'">${username}</span>
            </div>
        `;
    } else {
        userSection.innerHTML += `
            <a href="../html/login.html" class="ml-4 bg-green-900 text-white px-4 py-2 rounded">Login</a>
        `;
    }

    // Attach event listeners to the search input and close icon
    const searchInput = document.getElementById('titleInput');
    const closeIcon = document.querySelector('.close-icon');
    if (searchInput) {
        searchInput.addEventListener('input', handleInput);
    } else {
        console.error("Search input element not found");
    }
    if (closeIcon) {
        closeIcon.addEventListener('click', collapseSearch);
    } else {
        console.error("Close icon element not found");
    }
});

async function handleInput(event) {
    const query = event.target.value;
    if (query.length > 2) {
        const suggestions = await fetchSuggestions(query);
        displaySuggestions(suggestions);
    } else {
        clearSuggestions();
    }
}

async function fetchSuggestions(query) {
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${query}`);
    const data = await response.json();
    return data.items.map(item => ({
        title: item.volumeInfo.title,
        authors: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown',
        thumbnail: item.volumeInfo.imageLinks ? item.volumeInfo.imageLinks.thumbnail : 'https://via.placeholder.com/128x192?text=No+Image',
        isbn: item.volumeInfo.industryIdentifiers ? item.volumeInfo.industryIdentifiers[0].identifier : null
    }));
}

function displaySuggestions(suggestions) {
    const suggestionsBox = document.getElementById('suggestionsBox');
    if (suggestionsBox) {
        suggestionsBox.innerHTML = '';
        if (suggestions.length > 0) {
            suggestionsBox.style.display = 'block'; // Show the suggestions box
            suggestions.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.classList.add('suggestion-item', 'flex', 'items-center');
                suggestionItem.innerHTML = `
                    <div class="relative group w-full">
                        <a href="../html/book.html?isbn=${suggestion.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                            <img src="${suggestion.thumbnail}" alt="${suggestion.title}" class="w-8 h-12 mr-2">
                            <span>${suggestion.title} by ${suggestion.authors}</span>
                        </a>
                    </div>
                `;
                suggestionItem.querySelector('a').addEventListener('click', (event) => {
                    event.stopPropagation(); // Prevent parent click event
                    clearSuggestions(); // Hide the suggestions box when a book is clicked
                });
                suggestionsBox.appendChild(suggestionItem);
            });

            const showAllLink = document.createElement('div');
            showAllLink.classList.add('suggestion-item', 'flex', 'items-center', 'justify-center');
            showAllLink.innerHTML = `<span>Show all results for "${document.getElementById('titleInput').value}"</span>`;
            showAllLink.addEventListener('click', () => {
                searchBookByTitle();
                clearSuggestions(); // Hide the suggestions box when 'Show all results' is clicked
            });
            suggestionsBox.appendChild(showAllLink);
        } else {
            clearSuggestions();
        }
    } else {
        console.error("Suggestions box element not found");
    }
}

function clearSuggestions() {
    const suggestionsBox = document.getElementById('suggestionsBox');
    if (suggestionsBox) {
        suggestionsBox.innerHTML = '';
        suggestionsBox.style.display = 'none'; // Hide the suggestions box
    } else {
        console.error("Suggestions box element not found");
    }
}

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
    clearSuggestions(); // Hide the suggestions box
}

function handleSearch(event) {
    if (event.key === 'Enter') {
        searchBookByTitle();
        event.preventDefault();
    }
}

function searchBookByTitle() {
    const title = document.getElementById('titleInput').value;
    window.location.href = `searched.html?query=${title}`;
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
