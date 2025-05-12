document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username') || localStorage.getItem('username');
    const friendsTitle = document.getElementById('friendsTitle');
    friendsTitle.innerHTML = `Friends`;
    const friendsListContainer = document.getElementById('friendsList');
    const friendsButton = document.getElementById("friendsSection");
    const reviewsSection = document.getElementById("reviewsSection");
    const currentlyReadingButton = document.getElementById('currentlyReadingSection');
    const clubSection = document.getElementById('clubSection');
    const suggestedFriendsContainer = document.getElementById('suggestedFriendsList');
    let friendsSkip = 0;
    const FRIENDS_LIMIT = 5;

    // Add event listeners for navigation buttons
    friendsButton.addEventListener("click", function() {
        window.location.href = `friends.html?username=${encodeURIComponent(username)}`;
    });

    currentlyReadingButton.addEventListener("click", function() {
        window.location.href = `currentlyreading.html?username=${encodeURIComponent(username)}`;
    });    

    reviewsSection.addEventListener("click", function() {
        window.location.href = `social.html?username=${encodeURIComponent(username)}`;
    });

    clubSection.addEventListener("click", function() {
        window.location.href = `clubs.html?username=${encodeURIComponent(username)}`;
    });

    try {
        const response = await fetch(`/api/friends/${username}`);
        const data = await response.json();

        if (data.success) {
            friendsListContainer.innerHTML = '';
            const titleElement = document.createElement('h2');
            titleElement.classList.add('text-2xl', 'font-bold', 'mb-4', 'text-white');
            friendsListContainer.appendChild(titleElement);

            // Function to render friends
            const renderFriends = (friends) => {
                friends.forEach(friend => {
                    const friendCard = document.createElement('div');
                    friendCard.classList.add('bg-gray-800', 'p-4', 'rounded-lg', 'shadow-md', 'flex', 'justify-between', 'items-center', 'mb-4', 'transform', 'transition-all', 'duration-200', 'hover:scale-[1.02]');
                    friendCard.style.width = '600px';

                    friendCard.innerHTML = `
                        <div class="flex items-center space-x-4">
                            <div class="profile-pic">
                                <img src="../profile.png" alt="Profile Picture" class="w-12 h-12 rounded-full border-2 border-green-500">
                            </div>
                            <div class="username-container">
                                <a href="../html/profile.html?username=${friend.username}" class="text-white text-lg font-semibold hover:text-green-400 transition-colors">${friend.username}</a>
                            </div>
                        </div>
                        <div class="flex items-center space-x-4">
                            <button class="nudge-button group relative px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg"
                                    data-username="${friend.username}"
                                    data-tooltip="Send a friendly reminder to keep reading!">
                                <div class="flex items-center space-x-2">
                                    <svg class="w-5 h-5 transform group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                    </svg>
                                    <span>Nudge</span>
                                </div>
                            </button>
                        </div>
                    `;
                    friendsListContainer.appendChild(friendCard);

                    // Add click handler for nudge button
                    const nudgeButton = friendCard.querySelector('.nudge-button');
                    if (nudgeButton) {
                        nudgeButton.addEventListener('click', async () => {
                            const friendUsername = friend.username;
                            try {
                                const response = await fetch('/api/nudge-friend', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                        fromUsername: username,
                                        toUsername: friendUsername
                                    })
                                });

                                const data = await response.json();
                                if (data.success) {
                                    // Disable button temporarily with animation
                                    nudgeButton.disabled = true;
                                    nudgeButton.classList.add('bg-green-600', 'scale-95');
                                    nudgeButton.innerHTML = `
                                        <div class="flex items-center space-x-2">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
                                            </svg>
                                            <span>Nudged!</span>
                                        </div>
                                    `;
                                    setTimeout(() => {
                                        nudgeButton.disabled = false;
                                        nudgeButton.classList.remove('bg-green-600', 'scale-95');
                                        nudgeButton.innerHTML = `
                                            <div class="flex items-center space-x-2">
                                                <svg class="w-5 h-5 transform group-hover:rotate-12 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                                                </svg>
                                                <span>Nudge</span>
                                            </div>
                                        `;
                                    }, 2000);
                                }
                            } catch (error) {
                                console.error('Error sending nudge:', error);
                            }
                        });
                    }
                });
            };

            // Initial render of first 5 friends
            renderFriends(data.friends.slice(0, FRIENDS_LIMIT));

            // Add "Show More" button if there are more friends
            if (data.friends.length > FRIENDS_LIMIT) {
                const showMoreButton = document.createElement('button');
                showMoreButton.classList.add(
                    'w-full',
                    'mt-4',
                    'px-4',
                    'py-2',
                    'bg-gray-700',
                    'text-white',
                    'rounded-md',
                    'hover:bg-gray-600',
                    'transition-colors',
                    'duration-200',
                    'flex',
                    'items-center',
                    'justify-center',
                    'space-x-2'
                );
                showMoreButton.innerHTML = `
                    <span>Show More Friends</span>
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                    </svg>
                `;

                showMoreButton.addEventListener('click', () => {
                    friendsSkip += FRIENDS_LIMIT;
                    const nextFriends = data.friends.slice(friendsSkip, friendsSkip + FRIENDS_LIMIT);
                    renderFriends(nextFriends);

                    // Remove button if no more friends to show
                    if (friendsSkip + FRIENDS_LIMIT >= data.friends.length) {
                        showMoreButton.remove();
                    }
                });

                friendsListContainer.appendChild(showMoreButton);
            }
        } else {
            console.error('Failed to fetch friends:', data.message);
            friendsListContainer.innerHTML = '<p class="text-white">No friends found.</p>';
        }
    } catch (error) {
        console.error('Error fetching friends:', error);
        friendsListContainer.innerHTML = '<p class="text-white">Error loading friends.</p>';
    }

    // Add tooltip styles
    const style = document.createElement('style');
    style.textContent = `
        .tooltip {
            position: relative;
        }

        .tooltip:hover::before {
            content: attr(data-tooltip);
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            padding: 8px 12px;
            background-color: rgba(0, 0, 0, 0.9);
            color: white;
            border-radius: 4px;
            font-size: 14px;
            line-height: 1.4;
            white-space: nowrap;
            z-index: 1000;
            margin-bottom: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .tooltip:hover::after {
            content: '';
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            border-width: 6px;
            border-style: solid;
            border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent;
            margin-bottom: 2px;
        }
    `;
    document.head.appendChild(style);

    let suggestionsSkip = 0;
    const SUGGESTIONS_LIMIT = 5;

    async function loadSuggestedFriends() {
        try {
            console.log('Starting to load suggested friends for user:', username);
            const response = await fetch(`/api/suggested-friends/${username}?limit=${SUGGESTIONS_LIMIT}&skip=${suggestionsSkip}`);
            console.log('Suggested friends API response status:', response.status);
            const data = await response.json();
            
            // Add detailed logging of the response data
            console.log('=== Suggested Friends API Response ===');
            console.log('Success:', data.success);
            console.log('Number of suggestions:', data.suggestions ? data.suggestions.length : 0);
            console.log('Has more:', data.hasMore);
            console.log('Raw suggestions data:', JSON.stringify(data.suggestions, null, 2));
            console.log('===================================');

            const suggestedFriendsList = document.getElementById('suggestedFriendsList');
            if (!suggestedFriendsList) {
                console.error('Suggested friends container not found');
                return;
            }

            if (data.success) {
                if (suggestionsSkip === 0) {
                    // Use the existing suggestedFriendsList div instead of creating a new one
                    const suggestedFriendsList = document.getElementById('suggestedFriendsList');
                    suggestedFriendsList.innerHTML = ''; // Clear existing content
                }

                const suggestedFriendsList = document.getElementById('suggestedFriendsList');
                console.log('Number of suggestions received:', data.suggestions.length);

                data.suggestions.forEach(suggestion => {
                    console.log('Processing suggestion:', suggestion);
                    const suggestionCard = document.createElement('div');
                    suggestionCard.classList.add(
                        'bg-gray-800',
                        'p-4',
                        'rounded-lg',
                        'shadow-md',
                        'flex',
                        'justify-between',
                        'items-center',
                        'mb-2'
                    );
                    suggestionCard.style.width = '100%';

                    suggestionCard.innerHTML = `
                        <div class="flex items-center space-x-4">
                            <div class="profile-pic">
                                <img src="../profile.png" alt="Profile Picture" class="w-8 h-8 rounded-full">
                            </div>
                            <div class="flex flex-col">
                                <a href="../html/profile.html?username=${suggestion.username}" 
                                   class="text-white text-lg font-semibold">${suggestion.username}</a>
                                <span class="text-gray-400 text-sm">
                                    ${suggestion.mutualFriendsCount} mutual friend${suggestion.mutualFriendsCount > 1 ? 's' : ''}
                                    ${suggestion.mutualFriends.length > 0 ? 
                                        `(${suggestion.mutualFriends.join(', ')})` : ''}
                                </span>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button class="add-friend-button px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
                                Add Friend
                            </button>
                            <button class="dismiss-suggestion-button px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors">
                                ✕
                            </button>
                        </div>
                    `;

                    // Add event listeners for the buttons
                    const addButton = suggestionCard.querySelector('.add-friend-button');
                    const dismissButton = suggestionCard.querySelector('.dismiss-suggestion-button');

                    addButton.addEventListener('click', async () => {
                        console.log('Add friend button clicked for:', suggestion.username);
                        try {
                            const response = await fetch('/api/add-friend', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    username: username,
                                    friendUsername: suggestion.username
                                })
                            });
                            const data = await response.json();
                            console.log('Add friend response:', data);
                            if (data.success) {
                                suggestionCard.remove();
                            }
                        } catch (error) {
                            console.error('Error adding friend:', error);
                        }
                    });

                    dismissButton.addEventListener('click', async () => {
                        console.log('Dismiss button clicked for:', suggestion.username);
                        try {
                            const response = await fetch('/api/dismiss-friend-suggestion', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    username: username,
                                    suggestedUsername: suggestion.username
                                })
                            });
                            const data = await response.json();
                            console.log('Dismiss suggestion response:', data);
                            if (data.success) {
                                suggestionCard.remove();
                            }
                        } catch (error) {
                            console.error('Error dismissing suggestion:', error);
                        }
                    });

                    suggestedFriendsList.appendChild(suggestionCard);
                });

                // Add "Show More" button if there are more suggestions
                if (data.hasMore) {
                    console.log('Adding Show More button for suggestions');
                    const showMoreButton = document.createElement('button');
                    showMoreButton.classList.add(
                        'mt-4',
                        'px-4',
                        'py-2',
                        'bg-green-600',
                        'text-white',
                        'rounded-md',
                        'hover:bg-green-700',
                        'transition-colors',
                        'w-full'
                    );
                    showMoreButton.textContent = 'Show More Suggestions';
                    showMoreButton.onclick = () => {
                        suggestionsSkip += SUGGESTIONS_LIMIT;
                        loadSuggestedFriends();
                    };
                    suggestedFriendsList.appendChild(showMoreButton);
                }
            } else {
                console.log('Failed to load suggested friends:', data.message);
            }
        } catch (error) {
            console.error('Error loading suggested friends:', error);
        }
    }

    // Load suggested friends when the page loads
    await loadSuggestedFriends();
});
