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

// Add this new function to fetch friends' lists
async function loadFriendsLists() {
    try {
        const username = localStorage.getItem('username');
        const response = await fetch(`/api/users/${username}/friends-lists`);
        const data = await response.json();
        if (data.success) {
            return data.friendsLists;
        }
        return [];
    } catch (error) {
        console.error('Error loading friends lists:', error);
        showToast('Failed to load friends\' lists', 'error');
        return [];
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
            userLists = userLists.filter(list => list._id !== listId);
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

    listsContainer.innerHTML = '';
    
    // Create container for user's lists
    const userListsSection = document.createElement('div');
    userListsSection.className = 'mb-8';
    
    // Create grid container for user's lists
    const userGridContainer = document.createElement('div');
    userGridContainer.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';
    
    // Render user's lists
    userLists.forEach(list => {
        const listElement = createListElement(list, false);
        userGridContainer.appendChild(listElement);
    });

    userListsSection.appendChild(userGridContainer);
    listsContainer.appendChild(userListsSection);

    // Create and append friends' lists section
    loadFriendsLists().then(friendsLists => {
        if (friendsLists.length > 0) {
            // Create friends' lists section
            const friendsListsSection = document.createElement('div');
            friendsListsSection.className = 'mt-12';
            
            // Store friends' lists data for later use
            friendsListsSection.dataset.friendsLists = JSON.stringify(friendsLists);
            
            // Add section title
            const sectionTitle = document.createElement('h2');
            sectionTitle.className = 'text-2xl font-bold text-white mb-6';
            sectionTitle.textContent = "Friends' Lists";
            friendsListsSection.appendChild(sectionTitle);

            // Create grid container for friends' lists
            const friendsGridContainer = document.createElement('div');
            friendsGridContainer.className = 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';

            // Render friends' lists
            friendsLists.forEach(list => {
                const listElement = createListElement(list, true);
                friendsGridContainer.appendChild(listElement);
            });

            friendsListsSection.appendChild(friendsGridContainer);
            listsContainer.appendChild(friendsListsSection);
        }
    });
}

// Update createListElement to handle both user's lists and friends' lists
function createListElement(list, isFriendsList) {
    const listDiv = document.createElement('div');
    listDiv.className = 'bg-white rounded-lg shadow-md p-4 mb-4 hover:shadow-xl transition-shadow duration-300';
    listDiv.style.width = '300px';
    
    const bookCovers = list.books.slice(0, 4).map(book => book.thumbnail || 'https://via.placeholder.com/128x192?text=No+Image');
    while (bookCovers.length < 4) {
        bookCovers.push('https://via.placeholder.com/128x192?text=Empty');
    }

    const username = localStorage.getItem('username');
    const isLiked = list.likes?.some(like => like.username === username);

    listDiv.innerHTML = `
        <div>
            <!-- Book covers grid with hover effect -->
            <div class="relative group cursor-pointer mb-4" onclick="showListModal('${list._id}')">
                <div class="grid grid-cols-2 gap-2 aspect-square">
                    ${bookCovers.map(cover => `
                        <div class="relative w-full h-full">
                            <img src="${cover}" 
                                 alt="Book cover" 
                                 class="w-full h-full object-cover rounded-md">
                        </div>
                    `).join('')}
                </div>

                <!-- Hover overlay - different for user's lists and friend's lists -->
                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 rounded-lg flex items-center justify-center">
                    ${isFriendsList ? `
                        <!-- Friend's list hover overlay -->
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <div class="text-white text-center">
                                <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                                </svg>
                                <span class="text-sm font-medium">View List</span>
                            </div>
                        </div>
                    ` : `
                        <!-- User's list hover overlay with edit/delete buttons -->
                        <div class="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
                            <button class="text-white bg-blue-500 hover:bg-blue-600 p-2 rounded" 
                                    onclick="event.stopPropagation(); editList('${list._id}')">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                                </svg>
                            </button>
                            <button class="text-white bg-red-500 hover:bg-red-600 p-2 rounded" 
                                    onclick="event.stopPropagation(); deleteList('${list._id}')">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                </svg>
                            </button>
                        </div>
                    `}
                </div>
            </div>

            <!-- List information below the grid -->
            <div class="text-center">
                ${isFriendsList ? `
                    <p class="text-sm text-gray-500 mb-1">Created by ${list.username}</p>
                ` : ''}
                <h3 class="text-xl font-bold mb-2 cursor-pointer hover:text-blue-600" 
                    onclick="showListModal('${list._id}')">${list.listName}</h3>
                <div class="flex items-center justify-center space-x-4">
                    <p class="text-sm text-gray-500">${list.books.length} book${list.books.length !== 1 ? 's' : ''}</p>
                    <div class="flex items-center">
                        <button onclick="toggleListLike(event, '${list._id}')" 
                                class="flex items-center space-x-1 transition-colors duration-200 hover:text-red-500 ${isLiked ? 'text-red-500' : 'text-gray-400'}">
                            <svg class="w-5 h-5" 
                                 fill="${isLiked ? 'currentColor' : 'none'}" 
                                 stroke="currentColor" 
                                 viewBox="0 0 24 24">
                                <path stroke-linecap="round" 
                                      stroke-linejoin="round" 
                                      stroke-width="2" 
                                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z">
                                </path>
                            </svg>
                            <span class="text-sm">${list.likes?.length || 0}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    return listDiv;
}

// Show create list modal
function showCreateListModal(existingList = null) {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    // Step 1: List Details
    function showStep1() {
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-8 overflow-y-auto" style="width: 60vw; max-width: 1200px; max-height: 90vh;">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold">${existingList ? 'Edit List' : 'Create New List'}</h2>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
                <form id="list-details-form" class="space-y-6">
                    <div>
                        <label class="block text-lg font-medium text-gray-700 mb-2">List Name</label>
                        <input type="text" name="listName" required value="${existingList?.listName || ''}"
                               class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg p-3">
                    </div>
                    <div>
                        <label class="block text-lg font-medium text-gray-700 mb-2">Description</label>
                        <textarea name="description" rows="4"
                                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg p-3">${existingList?.description || ''}</textarea>
                    </div>
                    <div>
                        <label class="block text-lg font-medium text-gray-700 mb-2">Visibility</label>
                        <select name="visibility" required
                                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg p-3">
                            <option value="public" ${existingList?.visibility === 'public' ? 'selected' : ''}>Public</option>
                            <option value="friends" ${existingList?.visibility === 'friends' ? 'selected' : ''}>Friends Only</option>
                            <option value="private" ${existingList?.visibility === 'private' ? 'selected' : ''}>Private</option>
                        </select>
                    </div>
                    <div class="flex justify-end space-x-4 mt-8">
                        <button type="button" onclick="this.closest('.fixed').remove()"
                                class="px-6 py-3 text-lg font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                            Cancel
                        </button>
                        <button type="submit"
                                class="px-6 py-3 text-lg font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600">
                            Next: Add Books
                        </button>
                    </div>
                </form>
            </div>
        `;

        modal.querySelector('#list-details-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            showStep2({
                listName: formData.get('listName'),
                description: formData.get('description'),
                visibility: formData.get('visibility')
            });
        });
    }

    // Step 2: Add/Edit Books
    function showStep2(listDetails) {
        modal.innerHTML = `
            <div class="bg-white rounded-lg overflow-hidden flex flex-col" style="width: 60vw; max-width: 1200px; height: 70vh;">
                <!-- Header -->
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-2xl font-bold">${existingList ? 'Edit List' : 'Create New List'}</h2>
                            <p class="text-lg text-gray-500 mt-2">Adding books to "${listDetails.listName}"</p>
                        </div>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="flex-1 overflow-y-auto p-6">
                    <div class="space-y-6">
                        <!-- Search Section -->
                        <div>
                            <label class="block text-lg font-medium text-gray-700 mb-2">Search and Add Books</label>
                            <div class="relative">
                                <input type="text" 
                                       id="bookSearchInput" 
                                       placeholder="Search for books..."
                                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-lg p-3">
                                <div id="searchResults" 
                                     class="absolute z-10 w-full bg-white mt-1 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                </div>
                            </div>
                        </div>

                        <!-- Selected Books Section -->
                        <div id="selectedBooksContainer" class="${existingList?.books?.length ? '' : 'hidden'}">
                            <label class="block text-lg font-medium text-gray-700 mb-4">Selected Books</label>
                            <div id="selectedBooks" class="space-y-4 max-h-[400px] overflow-y-auto p-4 bg-gray-50 rounded-lg"></div>
                        </div>
                    </div>
                </div>

                <!-- Footer with Buttons -->
                <div class="p-6 border-t bg-gray-50">
                    <div class="flex justify-end space-x-4">
                        <button type="button" onclick="showStep1()"
                                class="px-6 py-3 text-lg font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors duration-200">
                            Back
                        </button>
                        <button type="button" onclick="saveList()"
                                class="px-6 py-3 text-lg font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors duration-200">
                            ${existingList ? 'Save Changes' : 'Create List'}
                        </button>
                    </div>
                </div>
            </div>
        `;

        setupBookSearch();

        // If editing, populate existing books
        if (existingList?.books) {
            const selectedBooks = document.getElementById('selectedBooks');
            existingList.books.forEach(book => {
                const bookElement = createBookElement(book);
                selectedBooks.appendChild(bookElement);
            });
        }

        // Add save functionality
        window.saveList = async () => {
            const username = localStorage.getItem('username');
            const selectedBooksContainer = document.getElementById('selectedBooks');
            const selectedBooks = Array.from(selectedBooksContainer?.children || []).map(bookElement => ({
                isbn: bookElement.dataset.isbn,
                title: bookElement.querySelector('.font-semibold').textContent,
                authors: bookElement.querySelector('.text-gray-600').textContent,
                thumbnail: bookElement.querySelector('img').src
            }));

            const listData = {
                username,
                ...listDetails,
                books: selectedBooks
            };

            try {
                const endpoint = existingList 
                    ? `/api/lists/${existingList._id}`
                    : '/api/lists/create';
                
                const method = existingList ? 'PUT' : 'POST';

                const response = await fetch(endpoint, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(listData)
                });

                const data = await response.json();
                if (data.success) {
                    showToast(existingList ? 'List updated successfully!' : 'List created successfully!', 'success');
                    loadUserLists();
                    modal.remove();
                } else {
                    showToast(data.message || 'Failed to save list', 'error');
                }
            } catch (error) {
                console.error('Error saving list:', error);
                showToast('Failed to save list', 'error');
            }
        };
    }

    // Start with step 1
    showStep1();
    document.body.appendChild(modal);
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-8 right-4 px-6 py-3 rounded-lg text-white ${
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
});

function setupBookSearch() {
    const searchInput = document.getElementById('bookSearchInput');
    const searchResults = document.getElementById('searchResults');
    
    console.log('Search Input:', searchInput); // Debug log
    console.log('Search Results:', searchResults); // Debug log
    
    if (!searchInput || !searchResults) {
        console.error('Search elements not found');
        return;
    }

    // Update search results container styling
    searchResults.style.display = 'none';
    searchResults.style.position = 'absolute';
    searchResults.style.zIndex = '9999'; // Increased z-index to ensure it's above other elements
    searchResults.style.width = '100%';
    searchResults.style.maxHeight = '300px';
    searchResults.style.overflowY = 'auto';
    searchResults.style.backgroundColor = 'white';
    searchResults.style.border = '1px solid #e5e7eb';
    searchResults.style.borderRadius = '0.375rem';
    searchResults.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    searchResults.style.marginTop = '4px';

    // Ensure the parent container has proper positioning
    const searchContainer = searchInput.parentElement;
    if (searchContainer) {
        searchContainer.style.position = 'relative';
    }

    searchInput.addEventListener('input', (e) => {
        console.log('Input event fired:', e.target.value); // Debug log
        const query = e.target.value.trim();
        
        if (query.length < 2) {
            searchResults.style.display = 'none';
            return;
        }

        // Show loading state
        searchResults.style.display = 'block';
        searchResults.innerHTML = '<div class="p-4 text-gray-500">Searching...</div>';

        // Debounce the search
        clearTimeout(searchInput.timeout);
        searchInput.timeout = setTimeout(() => {
            handleBookSearch(query);
        }, 300);
    });

    // Ensure the search container is visible when focusing on input
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2) {
            searchResults.style.display = 'block';
        }
    });

    // Prevent clicks within the search results from closing it
    searchResults.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });
}

async function handleBookSearch(query) {
    console.log('Handling search for query:', query); // Debug log
    
    if (!query || query.length < 2) {
        clearSearchResults();
        return;
    }

    try {
        const suggestions = await fetchBookSuggestions(query);
        console.log('Received suggestions:', suggestions); // Debug log
        displayBookSuggestions(suggestions);
    } catch (error) {
        console.error('Error searching books:', error);
        const searchResults = document.getElementById('searchResults');
        if (searchResults) {
            searchResults.innerHTML = '<div class="p-4 text-red-500">Error searching books</div>';
        }
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
    
    // Update container styling
    searchResults.style.display = 'block';
    searchResults.style.position = 'absolute';
    searchResults.style.zIndex = '9999';
    searchResults.style.width = '100%';
    searchResults.style.maxHeight = '300px';
    searchResults.style.overflowY = 'auto';
    searchResults.style.backgroundColor = 'white';
    searchResults.style.border = '1px solid #e5e7eb';
    searchResults.style.borderRadius = '0.375rem';
    searchResults.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    searchResults.style.marginTop = '4px';
    
    if (suggestions.length === 0) {
        searchResults.innerHTML = '<div class="p-4 text-gray-500">No books found</div>';
        return;
    }

    suggestions.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.className = 'flex items-center p-3 border-b hover:bg-gray-50 cursor-pointer transition-colors duration-200';
        bookElement.innerHTML = `
            <img src="${book.thumbnail}" alt="${book.title}" class="w-12 h-16 object-cover mr-3 rounded">
            <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm truncate">${book.title}</div>
                <div class="text-xs text-gray-600 truncate">${book.authors}</div>
            </div>
            <button class="ml-2 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors duration-200 text-sm flex-shrink-0">
                Add
            </button>
        `;

        bookElement.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            handleBookSelection(book);
            searchResults.style.display = 'none'; // Hide results after selection
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
    // Find the list in userLists array using the listId
    const list = userLists.find(list => list._id === listId);
    if (!list) {
        showToast('List not found', 'error');
        return;
    }
    
    // Show the modal with the existing list data
    showCreateListModal(list);
}

// Make functions available globally
window.editList = editList;
window.deleteList = deleteList;
window.removeBookFromList = removeBookFromList;
window.showCreateListModal = showCreateListModal;

function showListModal(listId) {
    // First try to find the list in user's lists
    let list = userLists.find(l => l._id === listId);
    
    // If not found in user's lists, try to find it in friends' lists
    if (!list) {
        const friendsListsContainer = document.querySelector('[data-friends-lists]');
        if (friendsListsContainer) {
            const friendsList = JSON.parse(friendsListsContainer.dataset.friendsLists)
                .find(l => l._id === listId);
            if (friendsList) {
                list = friendsList;
            }
        }
    }

    if (!list) return;

    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 w-[1000px] max-h-[85vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-6">
                <div>
                    <h2 class="text-2xl font-bold">${list.listName}</h2>
                    ${list.username && list.username !== localStorage.getItem('username') 
                        ? `<p class="text-sm text-gray-500 mt-1">Created by ${list.username}</p>` 
                        : ''}
                    ${list.description ? `<p class="text-gray-600 mt-2">${list.description}</p>` : ''}
                </div>
                <div class="flex items-center space-x-4">
                    <div class="flex items-center">
                        <button onclick="toggleListLike(event, '${list._id}')" 
                                class="flex items-center space-x-1 transition-colors duration-200 hover:text-red-500 ${list.likes?.some(like => like.username === localStorage.getItem('username')) ? 'text-red-500' : 'text-gray-400'}">
                            <svg class="w-6 h-6" 
                                 fill="${list.likes?.some(like => like.username === localStorage.getItem('username')) ? 'currentColor' : 'none'}" 
                                 stroke="currentColor" 
                                 viewBox="0 0 24 24">
                                <path stroke-linecap="round" 
                                      stroke-linejoin="round" 
                                      stroke-width="2" 
                                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z">
                                </path>
                            </svg>
                            <span class="text-sm">${list.likes?.length || 0}</span>
                        </button>
                    </div>
                    <button onclick="this.closest('.fixed').remove()" class="text-gray-500 hover:text-gray-700">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                ${list.books.map(book => `
                    <div class="flex flex-col items-center p-4 border rounded-lg hover:shadow-lg transition-shadow duration-200">
                        <img src="${book.thumbnail}" alt="${book.title}" class="w-32 h-48 object-cover mb-3 rounded-md shadow">
                        <h3 class="text-sm font-semibold text-center line-clamp-2 mb-1">${book.title}</h3>
                        <p class="text-xs text-gray-500 text-center line-clamp-1">${book.authors}</p>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

async function toggleListLike(event, listId) {
    event.stopPropagation(); // Prevent modal from opening when clicking like button
    const username = localStorage.getItem('username');
    
    // Find the list in either userLists or friendsLists
    let list = userLists.find(l => l._id === listId);
    if (!list) {
        const friendsListsContainer = document.querySelector('[data-friends-lists]');
        if (friendsListsContainer) {
            const friendsLists = JSON.parse(friendsListsContainer.dataset.friendsLists);
            list = friendsLists.find(l => l._id === listId);
        }
    }
    
    if (!list) return;

    // Check if user has liked the list by looking for their username in the likes array
    const isLiked = list.likes?.some(like => like.username === username);
    const endpoint = `/api/lists/${listId}/${isLiked ? 'unlike' : 'like'}`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username })
        });

        const data = await response.json();
        if (data.success) {
            // Update the likes array in the list object
            if (isLiked) {
                list.likes = list.likes.filter(like => like.username !== username);
            } else {
                if (!list.likes) list.likes = [];
                list.likes.push({
                    username: username,
                    timestamp: new Date()
                });
            }
            
            // Reload the lists to update the UI
            await loadUserLists();
            await loadFriendsLists();
            
            // Show success message
            showToast(isLiked ? 'Removed like from list' : 'Liked list', 'success');
        }
    } catch (error) {
        console.error('Error toggling list like:', error);
        showToast('Failed to update like', 'error');
    }
} 