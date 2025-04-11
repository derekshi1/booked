document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('query');
    if (query) {
        fetchSearchResults(query);
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

async function fetchSearchResults(query) {
    try {
        // Fetch unified search results
        const response = await fetch(`/api/unified-search?query=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.success) {
            displaySearchResults(data.results);
        } else {
            displayError('Failed to fetch search results');
        }
    } catch (error) {
        console.error('Error fetching search results:', error);
        displayError('An error occurred while fetching search results');
    }
}

function displaySearchResults(results) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = ''; // Clear previous results

    // Create sections for each type
    const sections = {
        users: createSection('Users'),
        lists: createSection('Lists'),
        books: createSection('Books')
    };

    // Add results to their respective sections
    if (results.users && results.users.length > 0) {
        results.users.forEach(user => {
            const userCard = createUserCard(user);
            sections.users.content.appendChild(userCard);
        });
        resultsDiv.appendChild(sections.users.container);
    }

    if (results.lists && results.lists.length > 0) {
        results.lists.forEach(list => {
            const listCard = createListCard(list);
            sections.lists.content.appendChild(listCard);
        });
        resultsDiv.appendChild(sections.lists.container);
    }

    if (results.books && results.books.length > 0) {
        results.books.forEach(book => {
            const bookCard = createBookCard(book);
            sections.books.content.appendChild(bookCard);
        });
        resultsDiv.appendChild(sections.books.container);
    }

    // If no results found
    if (!results.users.length && !results.lists.length && !results.books.length) {
        resultsDiv.innerHTML = '<p class="text-white text-center">No results found</p>';
    }
}

function createSection(title) {
    const container = document.createElement('div');
    container.className = 'mb-8';
    
    const heading = document.createElement('h2');
    heading.className = 'text-2xl font-bold mb-4 text-white';
    heading.textContent = title;
    
    const content = document.createElement('div');
    content.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    
    container.appendChild(heading);
    container.appendChild(content);
    
    return { container, content };
}

function createUserCard(user) {
    const card = document.createElement('div');
    card.className = `
        bg-white rounded-lg shadow-md p-4 flex items-center space-x-4 
        cursor-pointer transform transition-all duration-300 
        hover:shadow-xl hover:scale-105 hover:bg-gray-50
        hover:border-green-500 hover:border-2 border-2 border-transparent
    `;
    card.onclick = () => window.location.href = `../html/profile.html?username=${user.username}`;
    card.innerHTML = `
        <img src="${user.profilePicture}" alt="${user.username}" class="w-12 h-12 rounded-full">
        <div>
            <h3 class="font-bold text-lg">${user.username}</h3>
        </div>
    `;
    return card;
}

function createListCard(list) {
    const card = document.createElement('div');
    card.className = `
        bg-white rounded-lg shadow-md p-4 
        cursor-pointer transform transition-all duration-300 
        hover:shadow-xl hover:scale-105 hover:bg-gray-50
        hover:border-green-500 hover:border-2 border-2 border-transparent
    `;
    card.onclick = () => window.location.href = `../html/lists.html?list=${list.id}`;
    card.innerHTML = `
        <div class="flex items-start space-x-4">
            <img src="${list.thumbnail}" alt="${list.name}" class="w-20 h-28 object-cover rounded">
            <div>
                <h3 class="font-bold text-lg">${list.name}</h3>
                <p class="text-gray-600">by ${list.username}</p>
                <p class="text-sm text-gray-500">${list.bookCount} books</p>
            </div>
        </div>
    `;
    return card;
}

function createBookCard(book) {
    const card = document.createElement('div');
    card.className = `
        bg-white rounded-lg shadow-md p-4 
        cursor-pointer transform transition-all duration-300 
        hover:shadow-xl hover:scale-105 hover:bg-gray-50
        hover:border-green-500 hover:border-2 border-2 border-transparent
    `;
    card.onclick = () => window.location.href = `../html/book.html?isbn=${book.isbn}`;
    card.innerHTML = `
        <div class="flex items-start space-x-4">
            <img src="${book.thumbnail}" alt="${book.title}" class="w-20 h-28 object-cover rounded">
            <div>
                <h3 class="font-bold text-lg">${book.title}</h3>
                <p class="text-gray-600">by ${book.authors.join(', ')}</p>
            </div>
        </div>
    `;
    return card;
}

function displayError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<p class="text-red-500 text-center">${message}</p>`;
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




google.books.setOnLoadCallback(function() {
   console.log('Google Books API loaded successfully.');
});

