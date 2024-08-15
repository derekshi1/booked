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
