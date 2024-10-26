document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded and parsed');
    const searchInput = document.getElementById('aiSearchInput');

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
    document.getElementById('createListButton').addEventListener('click', () => {
        document.getElementById('createListModal').classList.remove('hidden');
    });
    
    document.getElementById('cancelButton').addEventListener('click', () => {
        document.getElementById('createListModal').classList.add('hidden');
    });
    
    // Attach input event listener to the title input field
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
                            <a href="../html/book.html?isbn=${suggestion.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                                <img src="${suggestion.thumbnail}" alt="${suggestion.title}" class="w-8 h-12 mr-2 rounded">
                                <span>${suggestion.title} by ${suggestion.authors}</span>
                            </a>
                        </div>
                `;
                suggestionItem.addEventListener('click', (e) => {
                    preventCollapse = true;
                    e.stopPropagation(); // Prevents any parent handlers from interfering
                    console.log('Suggestion clicked:', suggestion.title);
                    window.location.href = `../html/book.html?isbn=${suggestion.isbn}`;
                });             
                suggestionsBox.appendChild(suggestionItem);
            });

            const showAllLink = document.createElement('div');
            showAllLink.classList.add('suggestion-item', 'flex', 'items-center', 'justify-center', 'cursor-pointer', 'hover:bg-gray-200', 'p-2');
            showAllLink.innerHTML = `<span>Show all results for "${document.getElementById('titleInput').value}"</span>`;
            showAllLink.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Show all results clicked'); // Debug log
                searchBookByTitle();
                clearSuggestions(); // Hide the suggestions box when 'Show all results' is clicked
            });
            suggestionsBox.appendChild(showAllLink);
        } else {
            clearSuggestions();
        }
    } else {
        console.error('Suggestions box not found');
    }
}

function clearSuggestions() {
    const suggestionsBox = document.getElementById('suggestionsBox');
    suggestionsBox.innerHTML = ''; // Clear suggestions
    suggestionsBox.style.display = 'none'; // Hide suggestions box
}

// Placeholder for the fetchSuggestions function that retrieves book suggestions based on the query
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

function addToList(book) {
    // Logic to add the book to the user's list (e.g., save it in an array or display in UI)
    console.log('Added to list:', book.title);
    // Update the display area for added books here if necessary
}
    
    
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
