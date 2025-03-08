document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    const searchInput = document.getElementById('aiSearchInput');
    const createListModal = document.getElementById('createListModal');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const username = localStorage.getItem('username');
    // Buttons
    const createListButton = document.getElementById('createListButton');
    const cancelButton = document.getElementById('cancelButton');
    const nextButton = document.getElementById('nextButton');
    const backButton = document.getElementById('backButton');
    const createListFinalButton = document.getElementById('createListFinalButton');

    if (searchInput) {
        console.log('Search input found');
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                console.log('Enter key pressed');
                fetchList();
            }
        });
    } else {
        console.error('Search input not found');
    }
    createListButton.addEventListener('click', () => {
        createListModal.classList.remove('hidden');
        step1.classList.remove('hidden');
        step2.classList.add('hidden');
    });
    cancelButton.addEventListener('click', () => {
        createListModal.classList.add('hidden');
    });
    nextButton.addEventListener('click', () => {
        const listName = document.getElementById('listName').value;
        const tags = document.getElementById('tags').value;
        const visibility = document.getElementById('visibility').value;
        const description = document.getElementById('description').value;

        if (!listName || !visibility || !description) {
            alert("Please fill out all fields.");
            return;
        }

        // Store these values if you need to send them later
        localStorage.setItem("listName", listName);
        localStorage.setItem("tags", JSON.stringify(tags.split(','))); // Convert comma-separated string into an array
        localStorage.setItem("visibility", visibility);
        localStorage.setItem("description", description);

        step1.classList.add('hidden');
        step2.classList.remove('hidden');
    });
    backButton.addEventListener('click', () => {
        step2.classList.add('hidden');
        step1.classList.remove('hidden');
    });
document.getElementById('titleInput').addEventListener('input', handleInput);

async function handleInput(event) {
    const query = event.target.value; // Get the current value of the input field
    if (query.length > 2) { // Fetch suggestions only if the query length is greater than 2
        const suggestions = await fetchSuggestions(query); // Fetch the suggestions based on the query
        displaySuggestions(suggestions); // Display the suggestions
    } else {
        clearSuggestions(); // Clear suggestions if the query is too short
    }
}

function displaySuggestions(suggestions) {
    
    const suggestionsBox = document.getElementById('listSuggestionsBox');

    if (suggestionsBox) {
        console.log('Displaying suggestions:', suggestions); // Debug log
        suggestionsBox.innerHTML = '';
        if (suggestions.length > 0) {
            suggestionsBox.style.display = 'block'; // Show the suggestions box
            suggestions.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.classList.add('suggestion-item', 'flex', 'items-center', 'cursor-pointer', 'hover:bg-gray-200', 'p-2');
                suggestionItem.innerHTML = `
                    <div class="flex items-center suggestion-link" data-isbn="${suggestion.isbn}">
                        <img src="${suggestion.thumbnail}" alt="${suggestion.title}" class="w-8 h-12 mr-2 rounded">
                        <span>${suggestion.title} by ${suggestion.authors}</span>
                    </div>

                `;
                suggestionsBox.appendChild(suggestionItem);

                suggestionItem.addEventListener('click', (e) => {
                    preventCollapse = true;
                    console.log('Suggestion clicked:', suggestion.title);
                    addBookToList(suggestion); 
                    clearSuggestions();
                });             
            });


        } else {
            clearSuggestions();
        }
    } else {
        console.error('Suggestions box not found');
    }
}
let selectedBooks = JSON.parse(localStorage.getItem('selectedBooks')) || [];

function addBookToList(book) {
    const selectedBooksContainer = document.getElementById('selectedBooksContainer');
    const selectedBooksHeader = document.getElementById('selectedBooksHeader');
    const bookItem = document.createElement('div');

    selectedBooksContainer.classList.remove('hidden');
    selectedBooksHeader.classList.remove('hidden');
    bookItem.classList.add('flex', 'items-center', 'p-2', 'bg-white', 'shadow', 'rounded', 'mb-2');
    bookItem.dataset.isbn = book.isbn;

    bookItem.innerHTML = `
        <img src="${book.thumbnail}" alt="${book.title}" class="w-10 h-14 mr-3 rounded">
        <div class="relative flex-1">
            <button class="remove-book-button absolute top-0 right-0 text-red-500 font-bold rounded-full w-6 h-6 flex items-center justify-center hover:bg-gray-200">×</button>
            <p class="font-semibold">${book.title}</p>
            <p class="text-sm text-gray-600">by ${book.authors}</p>
        </div>

    `;

    selectedBooksContainer.appendChild(bookItem);

    selectedBooks.push(book);
    localStorage.setItem('selectedBooks', JSON.stringify(selectedBooks));
    bookItem.querySelector('.remove-book-button').addEventListener('click', () => {
        removeBookFromList(book.isbn);
    });
}
function removeBookFromList(isbn) {
    // Remove the book from the array
    selectedBooks = selectedBooks.filter(book => book.isbn !== isbn);

    // Save the updated array to localStorage
    localStorage.setItem('selectedBooks', JSON.stringify(selectedBooks));
    console.log("Removed book. Updated selectedBooks:", selectedBooks);

    // Remove the book from the DOM
    const bookItem = document.querySelector(`[data-isbn="${isbn}"]`);
    if (bookItem) {
        bookItem.remove();
    }

    // Hide the container and header if no books are left
    const selectedBooksContainer = document.getElementById('selectedBooksContainer');
    const selectedBooksHeader = document.getElementById('selectedBooksHeader');
    if (selectedBooks.length === 0) {
        selectedBooksContainer.classList.add('hidden');
        selectedBooksHeader.classList.add('hidden');
    }
}



function clearSuggestions() {
    const suggestionsBox = document.getElementById('listSuggestionsBox');
    suggestionsBox.innerHTML = ''; // Clear suggestions
    suggestionsBox.style.display = 'none'; // Hide suggestions box
}

async function fetchSuggestions(query) {
        const apiKey = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${query}&key=${apiKey}`);
        const data = await response.json();
    return data.items.map(item => ({
        title: item.volumeInfo.title,
        authors: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown',
        thumbnail: item.volumeInfo.imageLinks ? item.volumeInfo.imageLinks.thumbnail : 'https://via.placeholder.com/128x192?text=No+Image',
        isbn: item.volumeInfo.industryIdentifiers ? item.volumeInfo.industryIdentifiers[0].identifier : null
    }));

}

createListFinalButton.addEventListener('click', async () => {
    const listName = localStorage.getItem("listName");
    const tags = JSON.parse(localStorage.getItem("tags"));
    const visibility = localStorage.getItem("visibility");
    const description = localStorage.getItem("description");
    const selectedBooks = JSON.parse(localStorage.getItem("selectedBooks"))

    const listData = {
        listName,
        tags,
        visibility,
        description,
        books: selectedBooks
    };

    try {
        const response = await fetch(`/api/users/${username}/lists`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(listData)
        });

        const data = await response.json();
        if (data.success) {
            alert("List created successfully!");
            document.getElementById('createListModal').classList.add('hidden');
        } else {
            console.error('Error in response:', data.message);
            alert("Failed to create list. Please try again.");
        }
    } catch (error) {
        console.error('Error creating list:', error);
        alert("An error occurred while creating the list. Please try again.");
    }
});

    
});

async function fetchList() {
    const query = document.getElementById('aiSearchInput').value;
    console.log('Search query:', query);

    if (!query) {
        alert('Please enter a search query.');
        return;
    }

    try {
        console.log('Sending request to /api/generate-lists');
        const response = await fetch('/api/generate-lists', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        console.log('Response received');
        const data = await response.json();
        console.log('Response data:', data);

        if (data.success) {
            console.log('List from server:', JSON.stringify(data.list, null, 2)); // Log the entire list
            console.log('Displaying list');
            displayList(data.list); // Updated this line
        } else {
            console.error('Error in response:', data.error);
            alert('Failed to fetch list. Please try again.');
        }
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        alert('An error occurred while fetching lists. Please try again.');
    }
}

const displayList = (list) => {
    console.log('List to display:', list);
    const recommendationsContainer = document.getElementById('aiSuggestionsBox');
    if (!recommendationsContainer) {
        console.error('Recommendations container not found');
        return;
    }

    recommendationsContainer.innerHTML = '';

    if (!Array.isArray(list)) {
        console.error('Invalid list format', list);
        return;
    }

    list.forEach(recommendation => {
        console.log('Displaying recommendation:', recommendation);
        const recommendationElement = document.createElement('div');
        recommendationElement.classList.add('recommendation-card');
        recommendationElement.innerHTML = `
            <div class="relative group">
                <a href="../html/book.html?isbn=${recommendation.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                    <img src="${recommendation.thumbnail}" alt="${recommendation.title}" class="w-full h-72 object-cover">
                    <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                        <h2 class="text-lg font-bold">${recommendation.title}</h2>
                        <p class="text-gray-300">by ${recommendation.authors.join(', ')}</p>
                    </div>
                </a>
            </div>
        `;
        recommendationsContainer.appendChild(recommendationElement);
    });
};
