// Lists functionality
let currentUserId = null;
let userLists = [];

// Initialize lists functionality
async function initializeLists(userId) {
    currentUserId = userId;
    await loadUserLists();
    renderLists();
}

// Load user's lists from the server
async function loadUserLists() {
    try {
        const username = localStorage.getItem('username');
        const response = await fetch(`/api/users/${username}/lists`);
        const data = await response.json();
        if (data.success) {
            userLists = data.lists;
            renderLists();
        }
    } catch (error) {
        console.error('Error loading lists:', error);
        showToast('Failed to load lists', 'error');
    }
}

// Create a new list
async function createList(listName, description = '') {
    try {
        const username = localStorage.getItem('username');
        const response = await fetch('/api/lists/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                listName,
                description,
                tags: [],
                visibility: 'public',
                books: []
            })
        });

        const data = await response.json();
        if (data.success) {
            userLists.push(data.list);
            renderLists();
            showToast('List created successfully!', 'success');
        } else {
            showToast(data.message || 'Failed to create list', 'error');
        }
    } catch (error) {
        console.error('Error creating list:', error);
        showToast('Failed to create list', 'error');
    }
}

// Add a book to a list
async function addBookToList(listId, book) {
    try {
        const response = await fetch(`/api/lists/${listId}/books`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUserId,
                book
            })
        });

        if (response.ok) {
            const updatedList = await response.json();
            const listIndex = userLists.findIndex(l => l.id === listId);
            if (listIndex !== -1) {
                userLists[listIndex] = updatedList;
                renderLists();
                showToast('Book added to list!', 'success');
            }
        }
    } catch (error) {
        console.error('Error adding book to list:', error);
        showToast('Failed to add book to list', 'error');
    }
}

// Remove a book from a list
async function removeBookFromList(listId, bookId) {
    try {
        const response = await fetch(`/api/lists/${listId}/books/${bookId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: currentUserId
            })
        });

        if (response.ok) {
            const updatedList = await response.json();
            const listIndex = userLists.findIndex(l => l.id === listId);
            if (listIndex !== -1) {
                userLists[listIndex] = updatedList;
                renderLists();
                showToast('Book removed from list', 'success');
            }
        }
    } catch (error) {
        console.error('Error removing book from list:', error);
        showToast('Failed to remove book from list', 'error');
    }
}

// Delete a list
async function deleteList(listId) {
    if (!confirm('Are you sure you want to delete this list?')) {
        return;
    }

    try {
        const username = localStorage.getItem('username');
        const response = await fetch(`/api/lists/${listId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });

        if (response.ok) {
            userLists = userLists.filter(list => list.id !== listId);
            renderLists();
            showToast('List deleted successfully', 'success');
        } else {
            showToast('Failed to delete list', 'error');
        }
    } catch (error) {
        console.error('Error deleting list:', error);
        showToast('Failed to delete list', 'error');
    }
}

// Render the lists UI
function renderLists() {
    const listsContainer = document.getElementById('lists-container');
    if (!listsContainer) return;

    // Create new list button
    const createListButton = document.createElement('button');
    createListButton.className = 'bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded mb-4 flex items-center';
    createListButton.innerHTML = `
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        Create New List
    `;
    createListButton.onclick = showCreateListModal;
    listsContainer.innerHTML = '';
    listsContainer.appendChild(createListButton);

    if (userLists.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.className = 'text-center py-12 bg-white rounded-lg shadow-md';
        emptyState.innerHTML = `
            <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path>
            </svg>
            <h3 class="mt-2 text-sm font-medium text-gray-900">No lists yet</h3>
            <p class="mt-1 text-sm text-gray-500">Get started by creating a new list.</p>
        `;
        listsContainer.appendChild(emptyState);
        return;
    }

    // Render each list
    userLists.forEach(list => {
        const listElement = createListElement(list);
        listsContainer.appendChild(listElement);
    });
}

// Create a list element
function createListElement(list) {
    const listDiv = document.createElement('div');
    listDiv.className = 'bg-white rounded-lg shadow-md p-4 mb-4';
    
    listDiv.innerHTML = `
        <div class="flex justify-between items-center mb-4">
            <div>
                <h3 class="text-xl font-bold">${list.listName}</h3>
                <p class="text-sm text-gray-500">Created ${new Date(list.createdAt).toLocaleDateString()}</p>
            </div>
            <div class="flex space-x-2">
                <button class="text-blue-500 hover:text-blue-700" onclick="editList('${list.id}')">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </button>
                <button class="text-red-500 hover:text-red-700" onclick="deleteList('${list.id}')">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>
        </div>
        <p class="text-gray-600 mb-4">${list.description || 'No description'}</p>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            ${list.books.map(book => createBookCard(book, list._id)).join('')}
        </div>
    `;
    
    return listDiv;
}

// Create a book card for a list
function createBookCard(book, listId) {
    return `
        <div class="relative group">
            <img src="${book.thumbnail || 'https://via.placeholder.com/128x192?text=No+Image'}" 
                 alt="${book.title}" 
                 class="w-full h-64 object-cover rounded-lg shadow-md">
            <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                <button class="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200" 
                        onclick="removeBookFromList('${listId}', '${book.isbn}')">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        </div>
    `;
}

// Show create list modal
function showCreateListModal(existingList = null) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 w-96">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-xl font-bold">${existingList ? 'Edit List' : 'Create New List'}</h2>
                <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
            <form id="list-form" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">List Name</label>
                    <input type="text" name="listName" required value="${existingList?.listName || ''}"
                           class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Tags (comma-separated)</label>
                    <input type="text" name="tags" value="${existingList?.tags?.join(',') || ''}"
                           class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Visibility</label>
                    <select name="visibility" required
                            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <option value="public" ${existingList?.visibility === 'public' ? 'selected' : ''}>Public</option>
                        <option value="friends" ${existingList?.visibility === 'friends' ? 'selected' : ''}>Friends Only</option>
                        <option value="private" ${existingList?.visibility === 'private' ? 'selected' : ''}>Private</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Description</label>
                    <textarea name="description"
                              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">${existingList?.description || ''}</textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Add Books</label>
                    <div class="relative">
                        <input type="text" id="bookSearchInput" placeholder="Search for books..."
                               class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                        <div id="searchResults" class="absolute z-10 w-full bg-white mt-1 rounded-md shadow-lg max-h-60 overflow-y-auto"></div>
                    </div>
                    <div id="selectedBooksContainer" class="mt-4 hidden">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Selected Books</label>
                        <div id="selectedBooks" class="space-y-2 max-h-60 overflow-y-auto"></div>
                    </div>
                </div>
                <div class="flex justify-end space-x-2">
                    <button type="button" onclick="this.closest('.fixed').remove()"
                            class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                        Cancel
                    </button>
                    <button type="submit"
                            class="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600">
                        ${existingList ? 'Save Changes' : 'Create List'}
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Setup search functionality immediately after adding the modal
    setupBookSearch();
    
    modal.querySelector('#list-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const username = localStorage.getItem('username');
        
        // Get selected books from the selectedBooks container
        const selectedBooksContainer = document.getElementById('selectedBooks');
        const selectedBooks = Array.from(selectedBooksContainer?.children || []).map(bookElement => ({
            isbn: bookElement.dataset.isbn,
            title: bookElement.querySelector('.font-semibold').textContent,
            authors: bookElement.querySelector('.text-gray-600').textContent,
            thumbnail: bookElement.querySelector('img').src
        }));

        const listData = {
            username,
            listName: formData.get('listName'),
            tags: formData.get('tags').split(',').map(tag => tag.trim()).filter(Boolean),
            visibility: formData.get('visibility'),
            description: formData.get('description'),
            books: selectedBooks
        };

        try {
            // For new list creation, always use the create endpoint
            const response = await fetch('/api/lists/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(listData)
            });

            const data = await response.json();
            if (data.success) {
                showToast('List created successfully!', 'success');
                loadUserLists();
                modal.remove();
            } else {
                showToast(data.message || 'Failed to create list', 'error');
            }
        } catch (error) {
            console.error('Error creating list:', error);
            showToast('Failed to create list', 'error');
        }
    });
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white ${
        type === 'success' ? 'bg-green-500' : 'bg-red-500'
    } shadow-lg z-50`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Export functions for use in other files
window.initializeLists = initializeLists;
window.createList = createList;
window.addBookToList = addBookToList;
window.removeBookFromList = removeBookFromList;
window.deleteList = deleteList;
window.editList = editList;
window.showCreateListModal = showCreateListModal;

document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    if (!username) {
        window.location.href = '/login.html';
        return;
    }

    // Initialize lists
    loadUserLists();

    // Create list button event listener
    document.querySelector('button[onclick="showCreateListModal()"]').addEventListener('click', showCreateListModal);
});

function setupBookSearch() {
    const searchInput = document.getElementById('bookSearchInput');
    const searchResults = document.getElementById('searchResults');
    
    if (!searchInput || !searchResults) {
        console.error('Search elements not found');
        return;
    }

    let timeoutId;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            handleBookSearch(e.target.value);
        }, 500);
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.innerHTML = '';
        }
    });
}

async function handleBookSearch(query) {
    if (!query || query.length < 2) {
        clearSearchResults();
        return;
    }

    try {
        const suggestions = await fetchBookSuggestions(query);
        displayBookSuggestions(suggestions);
    } catch (error) {
        console.error('Error searching books:', error);
        showToast('Error searching books', 'error');
    }
}

async function fetchBookSuggestions(query) {
    const apiKey = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8';
    const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=intitle:${query}&key=${apiKey}`);
    const data = await response.json();
    
    return data.items?.map(item => ({
        title: item.volumeInfo.title,
        authors: item.volumeInfo.authors ? item.volumeInfo.authors.join(', ') : 'Unknown',
        thumbnail: item.volumeInfo.imageLinks?.thumbnail || 'https://via.placeholder.com/128x192?text=No+Image',
        isbn: item.volumeInfo.industryIdentifiers?.[0]?.identifier || null,
        description: item.volumeInfo.description || ''
    })) || [];
}

function displayBookSuggestions(suggestions) {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;

    searchResults.innerHTML = '';
    searchResults.style.display = 'block';
    
    if (suggestions.length === 0) {
        searchResults.innerHTML = '<div class="p-2 text-gray-500">No books found</div>';
        return;
    }

    suggestions.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.className = 'flex items-center p-2 border-b hover:bg-gray-100 cursor-pointer';
        bookElement.innerHTML = `
            <img src="${book.thumbnail}" alt="${book.title}" class="w-12 h-16 object-cover mr-3 rounded">
            <div class="flex-1">
                <div class="font-semibold text-sm">${book.title}</div>
                <div class="text-xs text-gray-600">${book.authors}</div>
            </div>
            <button class="ml-2 px-3 py-1 bg-green-900 text-white rounded hover:bg-green-800 text-sm">
                Add
            </button>
        `;

        bookElement.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            handleBookSelection(book);
        });

        searchResults.appendChild(bookElement);
    });
}

function handleBookSelection(book) {
    const selectedBooksContainer = document.getElementById('selectedBooksContainer');
    const selectedBooks = document.getElementById('selectedBooks');
    
    if (!selectedBooksContainer || !selectedBooks) {
        console.error('Selected books container not found');
        return;
    }

    // Check if book is already added
    if (selectedBooks.querySelector(`[data-isbn="${book.isbn}"]`)) {
        showToast('This book is already in the list', 'error');
        return;
    }

    // Convert authors array to string if it's an array
    const authorsString = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors;

    // Create book element
    const bookElement = document.createElement('div');
    bookElement.className = 'flex items-center p-2 bg-white rounded shadow-sm mb-2';
    bookElement.dataset.isbn = book.isbn;
    bookElement.innerHTML = `
        <img src="${book.thumbnail}" alt="${book.title}" class="w-12 h-16 object-cover mr-3 rounded">
        <div class="flex-1">
            <div class="font-semibold">${book.title}</div>
            <div class="text-sm text-gray-600">${authorsString}</div>
        </div>
        <button class="ml-2 text-red-500 hover:text-red-700">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        </button>
    `;

    // Add remove functionality
    bookElement.querySelector('button').addEventListener('click', () => {
        bookElement.remove();
        if (selectedBooks.children.length === 0) {
            selectedBooksContainer.classList.add('hidden');
        }
    });

    // Show the container and add the book
    selectedBooksContainer.classList.remove('hidden');
    selectedBooks.appendChild(bookElement);
    
    // Clear search
    document.getElementById('bookSearchInput').value = '';
    clearSearchResults();
    showToast('Book added to list', 'success');
}

function clearSearchResults() {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.innerHTML = '';
        searchResults.style.display = 'none';
    }
}

function editList(listId) {
    const list = document.querySelector(`[data-list-id="${listId}"]`);
    if (!list) return;

    showCreateListModal(list.dataset); // Pass the existing list data
}

// Make functions available globally
window.editList = editList;
window.deleteList = deleteList;
window.removeBookFromList = removeBookFromList;
window.showCreateListModal = showCreateListModal; 