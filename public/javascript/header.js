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
    logo.src = '../bookedlogo.png';
    logo.alt = 'Booked Logo';
    logo.classList.add('w-48', 'h-24', 'mr-4', 'logo-transition', 'object-contain');
    logo.style.marginTop = '-10px';
    logo.style.marginBottom = '-10px';
    logoLink.appendChild(logo);
    
    // Create and append navigation links
    const homeLink = document.createElement('a');
    homeLink.href = '../html/index.html';
    homeLink.classList.add('ml-4', 'font-bold', 'text-white', 'text-lg', 'px-4', 'py-2', 'rounded', 'mr-8');
    homeLink.textContent = 'Home';

    const listsLink = document.createElement('a');
    listsLink.href = '../html/lists.html';
    listsLink.classList.add('ml-4', 'font-bold', 'text-white', 'text-lg', 'px-4', 'py-2', 'rounded', 'mr-8');
    listsLink.textContent = 'Lists';

    const socialLink = document.createElement('a');
    socialLink.href = '../html/social.html';
    socialLink.id = 'socialTab';
    socialLink.classList.add('ml-4', 'font-bold', 'text-white', 'text-lg', 'px-4', 'py-2', 'rounded', 'mr-8');
    socialLink.textContent = 'Social';
    let socialTabClicked = false;  // Track if the social tab was clicked
    console.log('Social tab created:', socialLink); // Log creation of social tab



    const chatLink = document.createElement('a');
    chatLink.href = '../html/chat.html';
    chatLink.id = 'chatTab';
    chatLink.classList.add('ml-4', 'font-bold', 'text-white', 'text-lg', 'px-4', 'py-2', 'rounded', 'mr-8');
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
        <a href="../html/library.html" class="ml-4 font-bold text-white text-lg px-4 py-2 rounded library-link">Library</a>
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
                            <button id="closeNotificationDropdown" class="absolute top-2 right-2 text-gray-500 hover:text-red-600 text-lg font-bold leading-none focus:outline-none">
                                &times;
                            </button>
                        </div>
                        <div id="friendRequestsSection" class="border-b">
                            <div class="p-2 bg-gray-50">
                                <span class="font-semibold">Friend Requests</span>
                            </div>
                            <div id="friendRequestsList" class="max-h-48 overflow-y-auto">
                                <!-- Friend requests will be populated here -->
                            </div>
                        </div>
                        <div id="notificationList" class="notification-list max-h-96 overflow-y-auto">
                            <!-- Other notifications will be populated here -->
                        </div>
                        <div class="flex justify-center mt-2">
                            <button id="showMoreNotifications" class="hidden text-sm text-green-700 hover:text-green-900 focus:outline-none text-center flex flex-col items-center">
                                <span class="block">Show More</span>
                                <span class="block mt-1">
                                    <svg class="w-4 h-4 mx-auto" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </span>
                            </button>
                        </div>

                    </div>
                </div>
                <div class="flex flex-col items-center">
                    <img src="../profile.png" alt="Profile" class="w-6 h-6 mb-1 cursor-pointer" onclick="window.location.href='../html/profile.html'">
                    <span class="text-white font-bold username" onclick="window.location.href='../html/profile.html'">${username}</span>
                </div>
            </div>
        `;
    } else {
        userSection.innerHTML += `
            <a href="../html/login.html" class="ml-4 bg-green-900 text-black px-4 py-2 rounded">Login</a>
        `;
    }

    document.getElementById('closeNotificationDropdown').addEventListener('click', () => {
        document.getElementById('notificationDropdown').classList.add('hidden');
    });
    const searchIcon = document.querySelector('.search-icon');  // Get the search icon element
    const searchInput = document.getElementById('titleInput');
    const closeIcon = document.getElementById('closeSearchIcon');
    searchIcon.classList.add('search-icon-white');

    const expandSearchIcon = document.getElementById('expandSearchIcon');
    expandSearchIcon.addEventListener('click', expandSearch);
    closeIcon.addEventListener('click', collapseSearch);

    // Handle scrolling to change header background, logo, and link colors
    window.addEventListener('scroll', () => {
        const links = document.querySelectorAll('#logoAndHome a, #userSection a, .username');
        const usernameElement = document.querySelector('.username');

        if (usernameElement) {
            usernameElement.style.color = 'white';
        }
        if (window.scrollY > 50 && !logoChanged) {
            header.style.backgroundColor = 'rgba(45, 52, 45, 1)';
            searchIcon.classList.add('search-icon-white');

            // Fade out the current logo
            logo.style.opacity = '0';
            
            // After the fade-out transition is complete, change the src and fade back in
            logo.src = '../bookedlogo.png';
            logo.style.opacity = '1';
            logoChanged = true;
                
            // Keep all link colors white
            links.forEach(link => {
                link.style.color = 'white';
            });

        } else if (window.scrollY <= 50 && logoChanged) {
            header.style.backgroundColor = 'rgba(45, 52, 45, 1)';
            
            // Fade out the current logo
            logo.style.opacity = '0';
            searchIcon.classList.remove('search-icon-white');

            logo.src = '../bookedlogo.png';
            logo.style.opacity = '1';
            logoChanged = false;
            
            // Keep all link colors white
            links.forEach(link => {
                link.style.color = 'white';
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

if (username) {
    const notificationBell = document.querySelector('.notification-bell');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationCount = document.getElementById('notificationCount');
    
    // Toggle notification dropdown
    notificationBell.addEventListener('click', async (e) => {
        e.stopPropagation();
        const isHidden = notificationDropdown.classList.contains('hidden');
        notificationDropdown.classList.toggle('hidden');
        
        if (!isHidden) {
            // Dropdown is being closed, mark notifications as read
            try {
                const response = await fetch('/api/mark-notifications-read', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username })
                });
                
                if (response.ok) {
                    // Clear the notification count
                    notificationCount.classList.add('hidden');
                    notificationCount.textContent = '0';
                }
            } catch (error) {
                console.error('Error marking notifications as read:', error);
            }
        } else {
            // Dropdown is being opened
            fetchNotifications();
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', async (e) => {
        if (!notificationDropdown.contains(e.target) && !notificationBell.contains(e.target)) {
            if (!notificationDropdown.classList.contains('hidden')) {
            notificationDropdown.classList.add('hidden');
                // Mark notifications as read when closing
                try {
                    const response = await fetch('/api/mark-notifications-read', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ username })
            });
            
            if (response.ok) {
                        // Clear the notification count
                notificationCount.classList.add('hidden');
                        notificationCount.textContent = '0';
            }
        } catch (error) {
            console.error('Error marking notifications as read:', error);
                }
            }
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

    
    
let allActivities = [];
let activitiesShown = 0;
const NOTIFICATIONS_PER_PAGE = 10;

    // Function to fetch and display notifications
    
    async function fetchNotifications() {
        try {
        const username = localStorage.getItem('username');
        const [friendRequestsResponse, activitiesResponse, likesResponse, nudgesResponse] = await Promise.all([
            fetch(`/api/friend-requests/${username}`),
            fetch(`/api/friends-activities/${username}`),
            fetch(`/api/likes-notifications/${username}`),
            fetch(`/api/nudge-notifications/${username}`)
        ]);

        const friendRequestsData = await friendRequestsResponse.json();
        const activitiesData = await activitiesResponse.json();
        const likesData = await likesResponse.json();
        const nudgesData = await nudgesResponse.json();

        console.log('Nudges response:', nudgesResponse);
        console.log('Nudges data:', nudgesData);

        if (friendRequestsData.success && activitiesData.success && likesData.success && nudgesData.success) {
            // Render Friend Requests
            const friendRequestsList = document.getElementById('friendRequestsList');
            friendRequestsList.innerHTML = '';

            if (friendRequestsData.friendRequests.length === 0) {
                friendRequestsList.innerHTML = `
                    <div class="p-3 text-gray-500 text-sm text-center">
                        No pending friend requests
                    </div>
                `;
            } else {
                friendRequestsData.friendRequests.forEach(request => {
                    const requestElement = document.createElement('div');
                    requestElement.classList.add(
                        'p-3',
                        'border-b',
                        'hover:bg-gray-50',
                        'flex',
                        'items-center',
                        'justify-between'
                    );
                    requestElement.innerHTML = `
                        <div class="flex items-center">
                            <img src="../profile.png" alt="Profile" class="w-8 h-8 rounded-full mr-2">
                            <div>
                                <p class="font-semibold">${request.from.username}</p>
                                <p class="text-sm text-gray-500">Sent you a friend request</p>
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button class="decline-friend-button px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                                    data-request-id="${request._id}" 
                                    data-friend-username="${request.from.username}">
                                Decline
                            </button>
                            <button class="accept-friend-button px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                                    data-request-id="${request._id}" 
                                    data-friend-username="${request.from.username}">
                                Accept
                            </button>
                        </div>
                    `;
                    friendRequestsList.appendChild(requestElement);
                });

                // Add event listeners for both accept and decline buttons
                const acceptButtons = friendRequestsList.querySelectorAll('.accept-friend-button');
                const declineButtons = friendRequestsList.querySelectorAll('.decline-friend-button');

                acceptButtons.forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const requestId = e.target.getAttribute('data-request-id');
                        const friendUsername = e.target.getAttribute('data-friend-username');
                        await acceptFriendRequest(requestId, friendUsername);
                        fetchNotifications(); // Re-fetch after accepting
                    });
                });

                declineButtons.forEach(button => {
                    button.addEventListener('click', async (e) => {
                        const requestId = e.target.getAttribute('data-request-id');
                        const friendUsername = e.target.getAttribute('data-friend-username');
                        await declineFriendRequest(requestId, friendUsername);
                        fetchNotifications(); // Re-fetch after declining
                    });
                });
            }

            // Add Nudges Section
            const nudgesSection = document.createElement('div');
            nudgesSection.classList.add('border-b');
            nudgesSection.innerHTML = `
                <div class="p-2 bg-gray-50">
                    <span class="font-semibold">Reading Nudges</span>
                </div>
            `;
            const notificationList = document.getElementById('notificationList');
            notificationList.innerHTML = ''; // Clear existing notifications
            notificationList.appendChild(nudgesSection);

            // Add logging before rendering nudges
            console.log('Number of nudges:', nudgesData.nudges.length);
            console.log('Nudges to render:', nudgesData.nudges);

            // Render Nudges
            if (nudgesData.nudges && nudgesData.nudges.length > 0) {
                console.log('Rendering nudges:', nudgesData.nudges);
                nudgesData.nudges.forEach(nudge => {
                    console.log('Processing nudge:', nudge);
                    const nudgeElement = document.createElement('div');
                    nudgeElement.classList.add(
                        'notification-item',
                        'p-3',
                        'border-b',
                        'hover:bg-gray-50'
                    );
                    nudgeElement.innerHTML = `
                        <div class="flex items-center">
                            <div class="text-blue-500 mr-2">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fill-rule="evenodd" 
                                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" 
                                          clip-rule="evenodd"/>
                                </svg>
                            </div>
                            <div>
                                <p class="text-sm">
                                    <span class="font-semibold">${nudge.fromUsername}</span> 
                                    nudged you to get back to reading!
                                </p>
                                <span class="text-xs text-gray-500">${formatTimeAgo(nudge.timestamp)}</span>
                            </div>
                        </div>
                    `;
                    notificationList.appendChild(nudgeElement);
                });
            } else {
                console.log('No nudges found or empty array:', nudgesData.nudges);
                const noNudges = document.createElement('div');
                noNudges.classList.add('p-3', 'text-gray-500', 'text-sm', 'text-center');
                noNudges.textContent = 'No reading nudges';
                notificationList.appendChild(noNudges);
            }

            // Add Likes Section
            const likesSection = document.createElement('div');
            likesSection.classList.add('border-b');
            likesSection.innerHTML = `
                <div class="p-2 bg-gray-50">
                    <span class="font-semibold">Recent Likes</span>
                </div>
            `;
            notificationList.appendChild(likesSection);

            // Render Likes
            if (likesData.likes.length > 0) {
                likesData.likes.forEach(like => {
                    const likeElement = document.createElement('div');
                    likeElement.classList.add(
                        'notification-item',
                        'p-3',
                        'border-b',
                        'hover:bg-gray-50',
                        'flex',
                        'items-center',
                        'justify-between'
                    );

                    let likeContent = '';
                    if (like.type === 'review') {
                        likeContent = `
                            <div class="flex items-center">
                                <div class="text-red-500 mr-2">
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path>
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-sm">
                                        <span class="font-semibold">${like.likedBy.join(', ')}</span> 
                                        ${like.likedBy.length > 1 ? 'liked' : 'liked'} your review of 
                                        <span class="font-semibold">${like.bookTitle}</span>
                                    </p>
                                    <span class="text-xs text-gray-500">${formatTimeAgo(like.timestamp)}</span>
                                </div>
                            </div>
                            ${like.thumbnail ? `
                                <img src="${like.thumbnail}" alt="${like.bookTitle}" 
                                     class="w-10 h-14 object-cover rounded ml-2">
                            ` : ''}
                        `;
                    } else if (like.type === 'list') {
                        likeContent = `
                            <div class="flex items-center">
                                <div class="text-red-500 mr-2">
                                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path>
                                    </svg>
                                </div>
                                <div>
                                    <p class="text-sm">
                                        <span class="font-semibold">${like.likedBy.join(', ')}</span> 
                                        ${like.likedBy.length > 1 ? 'liked' : 'liked'} your list 
                                        <span class="font-semibold">${like.listName}</span>
                                    </p>
                                    <span class="text-xs text-gray-500">${formatTimeAgo(like.timestamp)}</span>
                                </div>
                            </div>
                        `;
                    }

                    likeElement.innerHTML = likeContent;
                    notificationList.appendChild(likeElement);
                });
            } else {
                const noLikes = document.createElement('div');
                noLikes.classList.add('p-3', 'text-gray-500', 'text-sm', 'text-center');
                noLikes.textContent = 'No new likes';
                notificationList.appendChild(noLikes);
            }

            // Add Activities Section Header
            const activitiesSection = document.createElement('div');
            activitiesSection.classList.add('border-b');
            activitiesSection.innerHTML = `
                <div class="p-2 bg-gray-50">
                    <span class="font-semibold">Recent Activities</span>
                </div>
            `;
            notificationList.appendChild(activitiesSection);

            // Prepare activity notifications
            allActivities = activitiesData.activities;
            activitiesShown = 0;
            renderNextNotifications(); // Load the first batch

            // Update notification count to include likes and nudges
            const totalNotifications = 
                friendRequestsData.friendRequests.length + 
                likesData.likes.length +
                nudgesData.nudges.length +
                activitiesData.activities.filter(a => !a.isRead).length;

            updateNotificationCount(totalNotifications);
        }
    } catch (error) {
        console.error('Error fetching notifications:', error);
    }
}

// Renders the next batch of activity notifications
function renderNextNotifications() {
                const notificationList = document.getElementById('notificationList');
    const showMoreButton = document.getElementById('showMoreNotifications');
    const nextBatch = allActivities.slice(activitiesShown, activitiesShown + NOTIFICATIONS_PER_PAGE);
                
    nextBatch.forEach(activity => {
                    const notificationItem = document.createElement('div');
        notificationItem.classList.add('notification-item', 'p-3', 'border-b', 'hover:bg-gray-50');
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
                    <span class="text-sm text-gray-500">${formatTimeAgo(activity.timestamp)}</span>
                            </div>
                            ${activity.thumbnail ? `
                                <img src="${activity.thumbnail}" alt="${activity.bookTitle}" class="w-10 h-14 object-cover rounded ml-2">
                            ` : ''}
                        </div>
                    `;
                    notificationList.appendChild(notificationItem);
                });
                
    activitiesShown += nextBatch.length;

    // Show or hide the button
    if (activitiesShown >= allActivities.length) {
        showMoreButton.style.display = 'none';
    } else {
        showMoreButton.style.display = 'block';
    }
}

// Update the Show More button click handler to include the scroll
document.getElementById('showMoreNotifications').addEventListener('click', () => {
    renderNextNotifications();
    // Only scroll when Show More is clicked
    document.getElementById('notificationList').scrollBy({ top: 300, behavior: 'smooth' });
});

    // Function to update notification count
async function updateNotificationCount(totalCount) {
    const notificationCount = document.getElementById('notificationCount');
    if (totalCount > 0) {
        notificationCount.textContent = totalCount > 99 ? '99+' : totalCount;
                    notificationCount.classList.remove('hidden');
                } else {
                    notificationCount.classList.add('hidden');
                }
}

// Add the acceptFriendRequest function if it's not already defined
async function acceptFriendRequest(requestId, friendUsername) {
    try {
        const response = await fetch('/api/accept-friend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username: localStorage.getItem('username'), 
                requestId, 
                friendUsername 
            })
        });
        
        const data = await response.json();
        if (data.success) {
            console.log('Friend request accepted successfully');
        } else {
            console.error('Failed to accept friend request:', data.message);
        }
    } catch (error) {
        console.error('Error accepting friend request:', error);
    }
}

// Add the declineFriendRequest function
async function declineFriendRequest(requestId, friendUsername) {
    try {
        const response = await fetch('/api/decline-friend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                username: localStorage.getItem('username'), 
                requestId, 
                friendUsername 
            })
        });
        
        const data = await response.json();
        if (data.success) {
            console.log('Friend request declined successfully');
        } else {
            console.error('Failed to decline friend request:', data.message);
            }
        } catch (error) {
        console.error('Error declining friend request:', error);
        }
    }

    // Initial fetch of notification count
    updateNotificationCount();
    
    // Update notifications every minute
    setInterval(updateNotificationCount, 60000);
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

function renderNotificationItem(activity) {
    if (activity.type === 'nudge') {
        return `
            <div class="notification-item p-3 border-b hover:bg-gray-50 ${activity.isRead ? '' : 'bg-blue-50'}">
                <div class="flex items-center">
                    <div class="text-blue-500 mr-2">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clip-rule="evenodd"/>
                        </svg>
                    </div>
                    <div>
                        <p class="text-sm">
                            <span class="font-semibold">${activity.bookTitle}</span> 
                            tells you that you haven't been reading lately...
                        </p>
                        <span class="text-xs text-gray-500">${formatTimeAgo(activity.timestamp)}</span>
                    </div>
                </div>
            </div>
        `;
    }
    // ... existing notification rendering code ...
}



