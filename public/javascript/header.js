document.addEventListener('DOMContentLoaded', async () => {

    const username = localStorage.getItem('username');
    const logoAndHomeContainer = document.getElementById('logoAndHome');
    const userSection = document.getElementById('userSection');
    const currentPath = window.location.pathname;

    // Create and append footer
    const footer = document.createElement('footer');
    footer.classList.add('sticky-footer', 'bg-green-850', 'text-white', 'text-center', 'py-2');
    footer.innerHTML = `
        <p>&copy; ${new Date().getFullYear()} <em>Booked</em>. All rights reserved.</p>
    `;
    document.body.appendChild(footer);

    const header = document.querySelector('.custom-header');
    let logoChanged = false;  // Track if the logo has already been changed

    // Create logo and home link elements
    const logoLink = document.createElement('a');
    logoLink.href = '../html/index.html';
    const logo = document.createElement('img');
    logo.src = '../logonobg.png';
    logo.alt = 'Booked Logo';
    logo.classList.add('w-100', 'h-12', 'mr-4', 'logo-transition');
    logoLink.appendChild(logo);
    
    // Create and append navigation links
    const homeLink = document.createElement('a');
    homeLink.href = '../html/index.html';
    homeLink.classList.add('ml-4','font-bold', 'text-green-900', 'text-lg', 'px-4', 'py-2', 'rounded', 'mr-8');
    homeLink.textContent = 'Home';

    const listsLink = document.createElement('a');
    listsLink.href = '../html/lists.html';
    listsLink.classList.add('ml-4', 'font-bold','text-green-900', 'text-lg', 'px-4', 'py-2', 'rounded', 'mr-8');
    listsLink.textContent = 'Lists';

    const socialLink = document.createElement('a');
    socialLink.href = '../html/social.html';
    socialLink.id = 'socialTab'; 
    socialLink.classList.add('ml-4', 'font-bold','text-green-900', 'text-lg', 'px-4', 'py-2', 'rounded', 'mr-8');
    socialLink.textContent = 'Social';
    let socialTabClicked = false;  // Track if the social tab was clicked
    console.log('Social tab created:', socialLink); // Log creation of social tab



    const chatLink = document.createElement('a');
    chatLink.href = '../html/chat.html';
    chatLink.id = 'chatTab';
    chatLink.classList.add('ml-4', 'font-bold','text-green-900', 'text-lg', 'px-4', 'py-2', 'rounded', 'mr-8');
    chatLink.textContent = 'Booked Chatbot';


    const notificationBadge = document.createElement('span');
    notificationBadge.id = 'notificationBadge'; // Give it the ID for styling
    notificationBadge.textContent = ''; // Set default content to an empty string
    notificationBadge.style.display = 'none'; // Ensure it is hidden by default

    socialLink.appendChild(notificationBadge); // Append to the social link
    // Append links to the container
    logoAndHomeContainer.appendChild(logoLink);
    logoAndHomeContainer.appendChild(homeLink);
    logoAndHomeContainer.appendChild(listsLink);
    logoAndHomeContainer.appendChild(socialLink);
    logoAndHomeContainer.appendChild(chatLink)

    console.log('Social tab appended to logoAndHomeContainer');

    await updateSocialTabNotification();

    if (!currentPath.includes('social.html')) {
        socialLink.addEventListener('click', () => {
            console.log('Social tab clicked on a different page');
            sessionStorage.setItem('socialTabClicked', 'true');  // Store click event in session storage
        });
    }

   
    userSection.innerHTML = `
        <div class="search-container relative">
            <img src="https://cdn-icons-png.flaticon.com/512/54/54481.png" alt="Search" class="search-icon w-6 h-6" id="expandSearchIcon">
            <input type="text" id="titleInput" placeholder="Search for books, authors, users, lists..." class="search-input">
            <img src="https://cdn-icons-png.flaticon.com/512/1828/1828778.png" alt="Close" class="close-icon w-6 h-6" id="closeSearchIcon">
            <div id="suggestionsBox" class="suggestions"></div> <!-- Suggestions Box -->
        </div>
        <a href="../html/library.html" class="ml-4 font-bold text-green-900 text-lg px-4 py-2 rounded library-link">Library</a>
    `;
    if (username) {
        userSection.innerHTML += `
            <div class="flex items-center space-x-4">
                <div class="relative">
                    <div class="notification-bell cursor-pointer">
                        <img src="https://cdn-icons-png.flaticon.com/512/3602/3602145.png" alt="Notifications" class="w-6 h-6">
                        <span id="notificationCount" class="notification-badge hidden"></span>
                    </div>
                    <div id="notificationDropdown" class="notification-dropdown hidden">
                        <div class="notification-header flex justify-between items-center p-2 border-b">
                            <span class="font-bold">Notifications</span>
                            <button id="markAllRead" class="text-sm text-blue-500 hover:text-blue-700">Mark all as read</button>
                        </div>
                        <div id="notificationList" class="notification-list max-h-96 overflow-y-auto">
                            <!-- Notifications will be populated here -->
                        </div>
                    </div>
                </div>
                <div class="flex flex-col items-center">
                    <img src="../profile.png" alt="Profile" class="w-6 h-6 mb-1 cursor-pointer" onclick="window.location.href='../html/profile.html'">
                    <span class="text-green-900 font-bold username" onclick="window.location.href='../html/profile.html'">${username}</span>
                </div>
            </div>
        `;
    } else {
        userSection.innerHTML += `
            <a href="../html/login.html" class="ml-4 bg-green-900 text-black px-4 py-2 rounded">Login</a>
        `;
    }
    const searchIcon = document.querySelector('.search-icon');  // Get the search icon element
    const searchInput = document.getElementById('titleInput');
    const closeIcon = document.getElementById('closeSearchIcon');

    const expandSearchIcon = document.getElementById('expandSearchIcon');
    expandSearchIcon.addEventListener('click', expandSearch);
    closeIcon.addEventListener('click', collapseSearch);

    // Handle scrolling to change header background, logo, and link colors
    window.addEventListener('scroll', () => {
        // Select all the links you want to change the color of
        const links = document.querySelectorAll('#logoAndHome a, #userSection a, .username');
        const usernameElement = document.querySelector('.username');

        if (usernameElement) {
            usernameElement.style.color = window.scrollY > 50 ? 'white' : '';
        }
        if (window.scrollY > 50 && !logoChanged) {
            header.style.backgroundColor = 'rgba(45, 52, 45, 1)'; // New background with slight transparency
            searchIcon.classList.add('search-icon-white'); // Add white color class

            // Fade out the current logo
            logo.style.opacity = '0';
            
            // After the fade-out transition is complete, change the src and fade back in
            logo.src = '../logonobg.png'; // New logo with correct background color
            logo.style.opacity = '1'; // Ensure logo is fully visible
            logoChanged = true; // Mark the logo as changed
                
            // Change all link colors to white
            links.forEach(link => {
                link.style.color = 'white';
            });

        } else if (window.scrollY <= 50 && logoChanged) {
            header.style.backgroundColor = 'rgba(233, 220, 175, 1)'; // Initial background color without transparency
            
            // Fade out the current logo
            logo.style.opacity = '0';
            searchIcon.classList.remove('search-icon-white'); // Remove white color class

            logo.src = '../logonobg.png'; // Original logo
            logo.style.opacity = '1'; // Ensure logo is fully visible
            logoChanged = false; // Mark the logo as reverted
            
            // Change all link colors back to their original color
            links.forEach(link => {
                link.style.color = ''; // Remove the inline color style, reverting to original
            });
        }
    });

    if (currentPath.includes('index.html')) {
        homeLink.classList.add('active-link');
    } else if (currentPath.includes('lists.html')) {
        listsLink.classList.add('active-link');
    } else if (currentPath.includes('social.html')) {
        socialLink.classList.add('active-link');
    } else if (currentPath.includes('library.html')) {
        document.querySelector('.library-link').classList.add('active-link');
    }

    // Attach event listeners to the search input and close icon
    if (searchInput) {
        searchInput.addEventListener('input', handleInput);
        searchInput.addEventListener('keydown', handleSearch);
    } else {
        console.error("Search input element not found");
    }
    if (closeIcon) {
        closeIcon.addEventListener('click', collapseSearch);
    } else {
        console.error("Close icon element not found");
    }


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
    try {
        const response = await fetch(`/api/unified-search?query=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.message);
        }

        return data.results.combined;
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        return [];
    }
}

async function updateSocialTabNotification() {
    try {
        const username = localStorage.getItem('username');

        const response = await fetch(`/api/activities/unread-count/${username}`);
        const data = await response.json();

        const notificationBadge = document.getElementById('notificationBadge');

        if (data.success) {
            const unreadCount = data.unreadCount;
            console.log("Notification number:", unreadCount);

            if (unreadCount > 0) {
                // Show the notification badge with the unread count
                notificationBadge.textContent = unreadCount;
                notificationBadge.style.display = 'inline-block'; // Show the badge
            } else {
                // Hide the notification badge if there are no unread notifications
                notificationBadge.style.display = 'none';  // Hide badge if there are no unread notifications
            }
        }
    } catch (error) {
        console.error('Error fetching unread notifications:', error);
    }
}


function displaySuggestions(suggestions) {
    const suggestionsBox = document.getElementById('suggestionsBox');
    
    if (!suggestionsBox) {
        console.error('Suggestions box not found');
        return;
    }

    suggestionsBox.innerHTML = '';
    
    if (suggestions.length > 0) {
        suggestionsBox.style.display = 'block';
        
        suggestions.forEach(suggestion => {
            const suggestionItem = document.createElement('div');
            suggestionItem.classList.add(
                'suggestion-item',
                'flex',
                'items-center',
                'cursor-pointer',
                'hover:bg-gray-200',
                'p-2'
            );

            // Different display format based on result type
            switch (suggestion.type) {
                case 'book':
                    suggestionItem.innerHTML = `
                        <div class="flex items-center w-full">
                            <a href="../html/book.html?isbn=${suggestion.isbn}" class="flex items-center w-full">
                                <img src="${suggestion.thumbnail}" alt="${suggestion.title}" class="w-8 h-12 mr-2 rounded">
                                <div>
                                    <div class="font-semibold">${suggestion.title}</div>
                                    <div class="text-sm text-gray-600">Book by ${suggestion.authors.join(', ')}</div>
                                </div>
                            </a>
                        </div>
                    `;
                    break;

                case 'list':
                    suggestionItem.innerHTML = `
                        <div class="flex items-center w-full">
                            <a href="../html/lists.html?list=${suggestion.id}" class="flex items-center w-full">
                                <img src="${suggestion.thumbnail}" alt="List thumbnail" class="w-8 h-12 mr-2 rounded">
                                <div>
                                    <div class="font-semibold">${suggestion.name}</div>
                                    <div class="text-sm text-gray-600">List by ${suggestion.username} • ${suggestion.bookCount} books</div>
                                </div>
                            </a>
                        </div>
                    `;
                    break;

                case 'user':
                    suggestionItem.innerHTML = `
                        <div class="flex items-center w-full">
                            <a href="../html/profile.html?username=${suggestion.username}" class="flex items-center w-full">
                                <img src="${suggestion.profilePicture}" alt="Profile picture" class="w-8 h-8 mr-2 rounded-full">
                                <div class="font-semibold">${suggestion.username}</div>
                            </a>
                        </div>
                    `;
                    break;
            }

            suggestionItem.addEventListener('click', (e) => {
                preventCollapse = true;
                e.stopPropagation();
            });

            suggestionsBox.appendChild(suggestionItem);
        });

        // Add "Show all results" link
        const showAllLink = document.createElement('div');
        showAllLink.classList.add(
            'suggestion-item',
            'flex',
            'items-center',
            'justify-center',
            'cursor-pointer',
            'hover:bg-gray-200',
            'p-2',
            'text-blue-600',
            'font-semibold'
        );
        showAllLink.innerHTML = `<span>Show all results for "${document.getElementById('titleInput').value}"</span>`;
        showAllLink.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            searchBookByTitle(); // You might want to update this function name to something more generic
            clearSuggestions();
        });
        suggestionsBox.appendChild(showAllLink);
    } else {
        clearSuggestions();
    }
}
});
function expandSearch() {
    const searchInput = document.getElementById('titleInput');
    const closeIcon = document.querySelector('.close-icon');
    const searchIcon = document.querySelector('.search-icon');  // Get the search icon element

    searchInput.classList.add('expanded');
    closeIcon.classList.add('visible');
    searchIcon.classList.add('hidden');  // Hide the search icon

    searchInput.focus();
}
function closeModal() {
    document.getElementById('myModal').classList.add('hidden');
    document.getElementById('myModal').classList.remove('flex');
}
function loadBook(isbn) {
    if (isbn) {
        initialize(isbn);
        document.getElementById('myModal').classList.remove('hidden');
        document.getElementById('myModal').classList.add('flex');
    } else {
        alert('ISBN not found.');
    }
}
function handleSearch(event) {
    if (event.key === 'Enter') {
        const query = event.target.value;
        // Modify to include users and lists in search results
        window.location.href = `../html/searched.html?query=${encodeURIComponent(query)}`;
    }
}

let preventCollapse = false;  // Flag to prevent collapse

// Add a mousedown event listener to the suggestions box
const suggestionsBox = document.getElementById('suggestionsBox');
if (suggestionsBox) {
    suggestionsBox.addEventListener('mousedown', () => {
        preventCollapse = true;  // Set the flag when the user clicks inside the suggestions box
    });
}


function collapseSearch() {
    if (preventCollapse) {
        preventCollapse = false;  // Reset the flag
        return;  // Do not collapse the search if a suggestion is clicked
    }
    const searchInput = document.getElementById('titleInput');
    const closeIcon = document.querySelector('.close-icon');
    searchInput.classList.remove('expanded');
    const searchIcon = document.querySelector('.search-icon');  // Get the search icon element
    closeIcon.classList.remove('visible');
    searchInput.value = '';  // Clear the input field
    clearSuggestions(); // Hide the suggestions box
    searchIcon.classList.remove('hidden');  // Show the search icon

}
function searchBookByTitle() {
    const title = document.getElementById('titleInput').value;
    window.location.href = `searched.html?query=${title}`;
}

window.onclick = function(event) {
    var modal = document.getElementById('myModal');
    if (event.target == modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
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

if (username) {
    const notificationBell = document.querySelector('.notification-bell');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationCount = document.getElementById('notificationCount');
    const markAllReadBtn = document.getElementById('markAllRead');
    
    // Toggle notification dropdown
    notificationBell.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.classList.toggle('hidden');
        if (!notificationDropdown.classList.contains('hidden')) {
            fetchNotifications();
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!notificationDropdown.contains(e.target) && !notificationBell.contains(e.target)) {
            notificationDropdown.classList.add('hidden');
        }
    });

    // Mark all notifications as read
    markAllReadBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/activities/mark-read/${username}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                const notificationItems = document.querySelectorAll('.notification-item.unread');
                notificationItems.forEach(item => item.classList.remove('unread'));
                notificationCount.classList.add('hidden');
                updateNotificationCount();
            }
        } catch (error) {
            console.error('Error marking notifications as read:', error);
        }
    });

    // Function to format time ago
    function formatTimeAgo(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const seconds = Math.floor((now - date) / 1000);
        
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        const months = Math.floor(days / 30);
        return `${months}mo ago`;
    }

    // Function to fetch and display notifications
    async function fetchNotifications() {
        try {
            const response = await fetch(`/api/friends-activities/${username}`);
            const data = await response.json();
            
            if (data.success) {
                const notificationList = document.getElementById('notificationList');
                notificationList.innerHTML = '';
                
                data.activities.forEach(activity => {
                    const notificationItem = document.createElement('div');
                    notificationItem.classList.add('notification-item');
                    if (!activity.isRead) {
                        notificationItem.classList.add('unread');
                    }
                    
                    let notificationText = '';
                    if (activity.action === 'became friends with') {
                        notificationText = `<strong>${activity.username}</strong> became friends with you`;
                    } else if (activity.action.includes('liked')) {
                        notificationText = `<strong>${activity.username}</strong> liked your ${activity.action.split(' ')[1]}`;
                    } else {
                        notificationText = `<strong>${activity.username}</strong> ${activity.action} <em>${activity.bookTitle}</em>`;
                    }
                    
                    notificationItem.innerHTML = `
                        <div class="flex items-center justify-between">
                            <div class="flex-grow">
                                <p>${notificationText}</p>
                                <span class="time">${formatTimeAgo(activity.timestamp)}</span>
                            </div>
                            ${activity.thumbnail ? `
                                <img src="${activity.thumbnail}" alt="${activity.bookTitle}" class="w-10 h-14 object-cover rounded ml-2">
                            ` : ''}
                        </div>
                    `;
                    
                    notificationList.appendChild(notificationItem);
                });
                
                updateNotificationCount();
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    // Function to update notification count
    async function updateNotificationCount() {
        try {
            const response = await fetch(`/api/activities/unread-count/${username}`);
            const data = await response.json();
            
            if (data.success) {
                const count = data.unreadCount;
                if (count > 0) {
                    notificationCount.textContent = count > 99 ? '99+' : count;
                    notificationCount.classList.remove('hidden');
                } else {
                    notificationCount.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Error updating notification count:', error);
        }
    }

    // Initial fetch of notification count
    updateNotificationCount();
    
    // Update notifications every minute
    setInterval(updateNotificationCount, 60000);
}


