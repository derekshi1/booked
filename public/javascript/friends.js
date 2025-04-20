document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    const friendsTitle = document.getElementById('friendsTitle');
    friendsTitle.innerHTML = `Friends`;
    const friendsListContainer = document.getElementById('friendsListContainer');
    const friendsButton = document.getElementById("friendsSection");
    const reviewsSection = document.getElementById("reviewsSection");


    try {
        const response = await fetch(`/api/friends/${username}`);
        const data = await response.json();

        if (data.success) {
            friendsListContainer.innerHTML = '';
            const titleElement = document.createElement('h2');
            titleElement.classList.add('text-2xl', 'font-bold', 'mb-4', 'text-white'); // Added 'text-white' class
            titleElement.innerHTML = `<em>${username}</em> Friends`; // Use innerHTML with <em> to italicize the username
            friendsListContainer.appendChild(titleElement);

            for (const friend of data.friends) {
                // Fetch additional data for each friend
                const [libraryResponse, friendsCountResponse] = await Promise.all([
                    fetch(`/api/library/${friend.username}`),
                    fetch(`/api/number-of-friends/${friend.username}`)
                ]);

                const libraryData = await libraryResponse.json();
                const friendsCountData = await friendsCountResponse.json();

                // Build the friend card with the format you provided
                const friendCard = document.createElement('div');
                friendCard.classList.add('bg-gray-800', 'p-4', 'rounded-lg', 'shadow-md', 'flex', 'justify-between', 'items-center', 'mb-2');
                friendCard.style.width = '600px'; // Set a specific width
                friendCard.style.height = '100px'; // Set a specific height

                friendCard.innerHTML = `
                        <div class="flex items-center space-x-4">
                            <div class="profile-pic">
                                <img src="../profile.png" alt="Profile Picture" class="w-8 h-8 rounded-full">
                            </div>
                            <div class="username-container">
                                <a href="../html/profile.html?username=${friend.username}" class="text-white text-lg font-semibold">${friend.username}</a>
                            </div>
                        </div>
                    <div class="flex items-center space-x-8">
                        <button class="nudge-button px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors tooltip"
                                data-username="${friend.username}"
                                data-tooltip="Send a notification that nudges a friend to keep reading!">
                            <span class="mr-1">👉</span> Nudge
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
                                // Disable button temporarily
                                nudgeButton.disabled = true;
                                nudgeButton.classList.add('bg-gray-400');
                                nudgeButton.textContent = 'Nudged!';
                                setTimeout(() => {
                                    nudgeButton.disabled = false;
                                    nudgeButton.classList.remove('bg-gray-400');
                                    nudgeButton.innerHTML = '<span class="mr-1">👉</span> Nudge';
                                }, 3000);
                            }
                        } catch (error) {
                            console.error('Error sending nudge:', error);
                        }
                    });
                }
            }
        } else {
            console.error('Failed to fetch friends:', data.message);
            friendsListContainer.innerHTML = '<p class="text-white">No friends found.</p>';
        }
    } catch (error) {
        console.error('Error fetching friends:', error);
        friendsListContainer.innerHTML = '<p class="text-white">Error loading friends.</p>';
    }

    // Add this CSS to the head of the document
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
            white-space: normal;
            z-index: 1000;
            width: max-content;
            max-width: 250px;
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
            console.log('Suggested friends API response data:', data);

            const suggestedFriendsContainer = document.getElementById('suggestedFriendsContainer');
            if (!suggestedFriendsContainer) {
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
