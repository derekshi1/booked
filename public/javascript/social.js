document.addEventListener('DOMContentLoaded', () => {
    const searchFriendInput = document.getElementById('searchFriendInput');
    const searchFriendButton = document.getElementById('searchFriendButton');
    const searchResults = document.getElementById('searchResults');
    const activitiesFeed = document.getElementById('activitiesFeed');
    const clearSearchButton = document.getElementById('clearSearchButton');
    const username = localStorage.getItem('username');
    console.log('DOM fully loaded and parsed');
    console.log(`Current logged in username: ${username}`);
    const formatTimeAgo = (timestamp) => {
        const now = new Date();
        const activityTime = new Date(timestamp);
        const diffInSeconds = Math.floor((now - activityTime) / 1000);
    
        const seconds = diffInSeconds;
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(weeks / 4.33);
        const years = Math.floor(months / 12);
    
        if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
        if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
        if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
    };
    
    const updateTimestamps = () => {
        const timeAgoElements = document.querySelectorAll('.time-ago');
        timeAgoElements.forEach(element => {
            const timestamp = element.getAttribute('data-timestamp');
            element.textContent = formatTimeAgo(timestamp);
        });
    };
    
    // Call updateTimestamps every hour
    setInterval(updateTimestamps, 3600000);
    const renderSearchResults = (results) => {
        const username = localStorage.getItem('username');
        console.log('Rendering search results', results);
    
        // Clear previous results
        searchResults.innerHTML = '';
    
        // Filter out the current user's own username from the search results
        const filteredResults = results.filter(user => user.username !== username);
    
        // If no results after filtering, display a "No user found" message
       
        const existingUsers = new Set();
    
        filteredResults.forEach(async (user) => {
            if (existingUsers.has(user.username)) {
                return; // Skip if this user is already rendered
            }
            existingUsers.add(user.username);
    
            const userElement = document.createElement('div');
            userElement.classList.add('search-result', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'mb-2');
    
            let buttonContent = '';
            let buttonDisabled = false;
    
            // Check if the user is already a friend or if a request is pending
            const friendshipStatus = await checkFriendshipStatus(username, user.username);
    
            if (friendshipStatus === 'friend') {
                buttonContent = 'Added';
                buttonDisabled = true;
            } else if (friendshipStatus === 'pending') {
                buttonContent = 'Pending';
                buttonDisabled = true;
            } else {
                buttonContent = 'Add Friend';
            }
            const buttonStyle = buttonDisabled ? 'p-2 bg-gray-500 text-white rounded' : 'p-2 bg-green-900 text-white rounded';
    
            userElement.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <a href="../html/profile.html?username=${user.username}" class="text-blue-600 hover:underline">${user.username}</a>
                </div>
                <button class="${buttonStyle}" data-username="${user.username}" ${buttonDisabled ? 'disabled' : ''}>
                    ${buttonContent}
                </button>
            </div>
            `;
            searchResults.appendChild(userElement);
    
            if (!buttonDisabled) {
                const addFriendButton = userElement.querySelector('button');
                addFriendButton.addEventListener('click', async (event) => {
                    const friendUsername = event.target.getAttribute('data-username');
                    console.log(`Adding friend: ${friendUsername}`);
                    await sendFriendRequest(friendUsername);
                    addFriendButton.textContent = 'Pending';
                    addFriendButton.disabled = true;
                });
            }
        });
    };
    
     const renderActivitiesFeed = (activities) => {
        console.log('Activities to be rendered:', activities);  // Logging the activities
    
        // Group activities by user and remove duplicates
        const seenActivities = new Set();
        const activitiesByUser = activities.reduce((acc, activity) => {
            const { username } = activity;
            const activityKey = `${activity.username}-${activity.action}-${activity.bookTitle}`;

            if (!seenActivities.has(activityKey)) {
                seenActivities.add(activityKey);

                if (!acc[username]) {
                    acc[username] = [];
                }

                acc[username].push(activity);
            }

            return acc;
        }, {});

        activitiesFeed.innerHTML = '';

        // Iterate over users and render their activities
        Object.keys(activitiesByUser).forEach(username => {
            const userActivities = Object.values(activitiesByUser[username]).flat();
            const mostRecentActivity = userActivities[0];
        
            const activityElement = document.createElement('div');
            activityElement.classList.add('activity', 'p-2', 'bg-gray-100', 'rounded', 'shadow', 'mb-2');
            activityElement.setAttribute('data-total-activities', userActivities.length);
        
            let activityContent;
        
            if (mostRecentActivity.action.includes("became friends with")) {
                // Activity related to friendship
                activityContent = `
                    <div class="flex justify-between items-center">
                        <div>
                            <a href="../html/profile.html?username=${mostRecentActivity.username}" class="text-blue-500 hover:underline hover:font-bold">
                                <strong>${mostRecentActivity.username}</strong>
                            </a> 
                            ${mostRecentActivity.action}
                            <a href="../html/profile.html?username=${mostRecentActivity.bookTitle}" class="text-blue-500 hover:underline hover:font-bold">
                                ${mostRecentActivity.bookTitle}
                            </a>
                        </div>
                    </div>

                `;
            } else {
                // Activity related to books
                activityContent = `
                    <div class="flex justify-between items-center">
                        <div>
                            <a href="../html/profile.html?username=${mostRecentActivity.username}" class="text-blue-500 hover:underline">
                                <strong>${mostRecentActivity.username}</strong>
                            </a> 
                            ${mostRecentActivity.action} 
                            <a href="../html/book.html?isbn=${mostRecentActivity.isbn}" class="text-gray-500 hover:text-gray-800 hover:font-bold">
                                <em>${mostRecentActivity.bookTitle}</em>
                            </a>
                        </div>
                        <div class="relative">
                            <img src="${mostRecentActivity.thumbnail}" alt="${mostRecentActivity.bookTitle}" class="w-16 h-24 object-cover rounded ml-4">
                        </div>
                    </div>
        
                    <div class="review-content hidden p-4 bg-gray-100" style="margin-top: -20px;">
                        <p class="review-text text-sm">
                            <strong>${mostRecentActivity.username}</strong> review: "${mostRecentActivity.review}"
                        </p>
                        <p class="rating-text text-sm">
                            Rating: <strong>${mostRecentActivity.rating}/100</strong>
                        </p>
                    </div>
                `;
            }
        
            activityElement.innerHTML = activityContent + `
                <div class="flex justify-between items-end mt-2 relative">
                    <p class="time-ago text-gray-600 text-xs">${formatTimeAgo(mostRecentActivity.timestamp)}</p>
                    ${userActivities.length > 1 ? `
                        <a href="#" class="text-blue-500 hover:underline hover:italic see-more" data-username="${username}">
                            See ${userActivities.length - 1} more actions...
                        </a>` : ''}
                </div>
            `;
        
            activitiesFeed.appendChild(activityElement);
        
            if (userActivities.length > 1) {
                const seeMoreLink = activityElement.querySelector('.see-more');
                seeMoreLink.addEventListener('click', (event) => {
                    event.preventDefault();
                    renderAdditionalActivities(userActivities.slice(1), activityElement, seeMoreLink);
                });
            }
        });
        
    };
    
    const renderAdditionalActivities = (activities, containerElement, seeMoreLink) => {
        // Clear any previously added additional activities
        containerElement.querySelectorAll('.additional-activity').forEach(activityEl => activityEl.remove());
    
        // Add up to 5 more activities
        activities.slice(0, 5).forEach(activity => {
            const additionalActivityElement = document.createElement('div');
            additionalActivityElement.classList.add('activity', 'p-2', 'bg-gray-50', 'rounded', 'shadow', 'mb-2', 'ml-4', 'additional-activity');
    
            additionalActivityElement.innerHTML = `
                    <div class="flex justify-between items-center">
                        <div>
                            ${activity.action}  
                            <a href="../html/book.html?isbn=${activity.isbn}" class="text-gray-500 hover:text-gray-800 hover:font-bold">
                                <em>${activity.bookTitle}</em>
                            </a>
                        </div>
                        <div class="relative">
                            <img src="${activity.thumbnail}" alt="${activity.bookTitle}" class="w-16 h-24 object-cover rounded ml-4">
                        </div>
                    </div>
                    <div class="review-content hidden p-4 bg-gray-100" style="margin-top: -20px; rounded">
                        <p class="review-text text-sm">
                            <strong>${activity.username}</strong> review: "${activity.review}"
                        </p>
                        <p class="rating-text text-sm">
                            Rating: <strong>${activity.rating}/100</strong>
                        </p>
                    </div>
                    <div class="flex justify-between items-end mt-2 relative">
                        <p class="time-ago text-gray-600 text-xs">${formatTimeAgo(activity.timestamp)}</p>
                        ${activity.action.includes('reviewed') ? `
                        <a href="#" class="see-review-link text-gray-500 hover:underline" 
                            style="position: absolute; bottom: 20px; left: 0; font-size: 15px;" 
                            data-username="${activity.username}" 
                            data-isbn="${activity.isbn}">
                            see review...
                        </a>
                        ` : ''}
                    </div> 
                `;
    
            containerElement.appendChild(additionalActivityElement);
        });
    
        const remainingActions = activities.length - 5;
    
        if (remainingActions > 0) {
            seeMoreLink.textContent = `See ${remainingActions} more actions...`;
        } else {
            seeMoreLink.textContent = 'See less actions';
        }
    
        // Update event listener for "See less"
        seeMoreLink.removeEventListener('click', handleSeeMoreClick);
        seeMoreLink.addEventListener('click', handleSeeLessClick);
    };
    
    function handleSeeLessClick(event) {
        event.preventDefault();
        const seeMoreLink = event.target;
        const containerElement = seeMoreLink.closest('.activity');
        
        // Remove only the additional activities
        containerElement.querySelectorAll('.additional-activity').forEach(activityEl => activityEl.remove());
    
        // Retrieve the original total number of activities from a stored data attribute
        const totalActivities = parseInt(containerElement.getAttribute('data-total-activities'), 10);
        
        // Calculate remaining actions (original total minus one for the most recent activity)
        const remainingActions = totalActivities - 1;
        
        seeMoreLink.textContent = `See ${remainingActions} more actions...`;
    
        // Reset event listener for "See more"
        seeMoreLink.removeEventListener('click', handleSeeLessClick);
        seeMoreLink.addEventListener('click', handleSeeMoreClick);
    }
    
    
    function handleSeeMoreClick(event) {
        event.preventDefault();
        const seeMoreLink = event.target;
        const username = seeMoreLink.getAttribute('data-username');
        const activities = activitiesByUser[username];
        renderAdditionalActivities(activities.slice(1), seeMoreLink.closest('.activity'), seeMoreLink);
    }
    
    
    
    
    
    
    let debounceTimeout;
    let currentDisplayedUsers = [];
    
    const searchFriends = async (query) => {
        clearTimeout(debounceTimeout);
    
        debounceTimeout = setTimeout(async () => {
            if (!query) {
                console.log('Search query is empty');
                renderSearchResults([]); // Clear results if the query is empty
                return;
            }
    
            console.log(`Searching friends with query: ${query}`);
            try {
                const response = await fetch(`/api/search-users?query=${encodeURIComponent(query)}`);
                const data = await response.json();
                if (data.success) {
                    console.log('Search results fetched successfully', data.users);
    
                    // Only render if the results have changed
                    const newUsers = data.users.map(user => user.username).sort().join(',');
                    const displayedUsers = currentDisplayedUsers.sort().join(',');
    
                        if (newUsers !== displayedUsers) {
                        currentDisplayedUsers = data.users.map(user => user.username);
                        renderSearchResults(data.users);
                    }
                } else {
                    console.error('Failed to search users:', data.message);
                    renderNoUserFound();
                }
            } catch (error) {
                console.error('Error searching users:', error);
                renderNoUserFound();
            }
        }, 300); // Adjust the debounce delay as needed
    };
    
    searchFriendInput.addEventListener('input', (event) => {
        const query = event.target.value.trim();
        if (query) {
            clearSearchButton.style.display = 'inline-block'; // Show the 'x' button
        } else {
            clearSearchButton.style.display = 'none'; // Hide the 'x' button
        }
        searchFriends(query); 
    });
    clearSearchButton.addEventListener('click', () => {
        searchFriendInput.value = ''; // Clear the search input
        clearSearchButton.style.display = 'none'; // Hide the 'x' button
        renderSearchResults([]); // Clear the search results
    });
    
    const sendFriendRequest = async (friendUsername) => {
        console.log(`Sending request to add friend: ${friendUsername}`);
        try {
            const response = await fetch('/api/add-friend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, friendUsername })
            });
            const data = await response.json();
            if (data.success) {
                console.log('Friend request sent successfully');
                alert('Friend request sent successfully');
            } else {
                console.error('Failed to send friend request:', data.message);
            }
        } catch (error) {
            console.error('Error sending friend request:', error);
        }
    };

    const fetchActivities = async () => {
        console.log(`Fetching activities for user: ${username}`);
        try {
            const response = await fetch(`/api/friends-activities/${username}`);
            if (!response.ok) {
                throw new Error(`Error fetching activities: ${response.statusText}`);
            }
    
            const data = await response.json();
            if (data.success) {
                console.log('Activities fetched successfully', data.activities);
                renderActivitiesFeed(data.activities); // This will now include the thumbnail and isbn
            } else {
                console.error('Failed to fetch activities:', data.message);
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
        }
    };
    
    const fetchFriendRequests = async () => {
        console.log(`Fetching friend requests for user: ${username}`);
        try {
            const response = await fetch(`/api/friend-requests/${username}`);
            const data = await response.json();
            if (data.success) {
                console.log('Friend requests fetched successfully', data.friendRequests);
                renderFriendRequests(data.friendRequests);
            } else {
                console.error('Failed to fetch friend requests:', data.message);
            }
        } catch (error) {
            console.error('Error fetching friend requests:', error);
        }
    };

    const renderFriendRequests = (requests) => {
        const friendRequestsContainer = document.getElementById('friendRequests');
        friendRequestsContainer.innerHTML = '';
    
        if (requests.length === 0) {
            // Display default message if no friend requests
            friendRequestsContainer.innerHTML = '<p class="text-gray-300 text-center">No friend requests :(</p>';
            return;
        }
    
        requests.forEach(request => {
            const requestElement = document.createElement('div');
            requestElement.classList.add('request', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'mb-2');
            requestElement.innerHTML = `
            <div class="flex justify-between items-center">
                <div>
                    <a href="../html/profile.html?username=${request.from.username}" class="text-blue-600 hover:underline">${request.from.username}</a>
                </div>
                <button class="accept-friend-button p-2 bg-green-900 text-white rounded" data-request-id="${request._id}" data-friend-username="${request.from.username}">Accept</button>
            </div>
        `;
            friendRequestsContainer.appendChild(requestElement);
        });
    
        const acceptFriendButtons = document.querySelectorAll('.accept-friend-button');
        acceptFriendButtons.forEach(button => {
            button.addEventListener('click', async (event) => {
                const requestId = event.target.getAttribute('data-request-id');
                const friendUsername = event.target.getAttribute('data-friend-username'); // Assuming you add this data attribute to the button
                console.log(`Accepting friend request: ${requestId}`);
                await acceptFriendRequest(requestId, friendUsername);
            });
        });
    };
    

    const acceptFriendRequest = async (requestId, friendUsername) => {
        console.log(`Sending request to accept friend request: ${requestId}`);
        try {
            const response = await fetch('/api/accept-friend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, requestId, friendUsername })
            });
            const data = await response.json();
            if (data.success) {
                console.log('Friend request accepted successfully');
                alert('Friend request accepted successfully');
                fetchFriendRequests(); // Refresh friend requests
                fetchActivities(); // Refresh activities feed
            } else {
                console.error('Failed to accept friend request:', data.message);
            }
        } catch (error) {
            console.error('Error accepting friend request:', error);
        }
    };
    
    searchFriendButton.addEventListener('click', searchFriends);

    // Initial fetch of friends' activities and friend requests
    fetchActivities();
    fetchFriendRequests();
    
    activitiesFeed.addEventListener('click', async (event) => {
        const reviewLink = event.target.closest('.see-review-link');
        
        if (reviewLink) {
            event.preventDefault(); // Prevent the default link behavior
            const reviewContentDiv = reviewLink.closest('.activity').querySelector('.review-content');
            const reviewText = reviewContentDiv.querySelector('.review-text');
            const ratingText = reviewContentDiv.querySelector('.rating-text');
            const username = reviewLink.getAttribute('data-username');
            const isbn = reviewLink.getAttribute('data-isbn');
    
            // Toggle visibility of the review content
            if (reviewContentDiv.classList.contains('hidden')) {
                try {
                    const response = await fetch(`/api/library/review/${username}/${isbn}`);
                    const data = await response.json();
    
                    if (data.success) {
                        reviewText.innerHTML = `"${data.review || 'No review available'}"`;
                        ratingText.innerHTML = `Rating: <strong>${data.rating || 'Not rated'}/100</strong>`;
                        reviewText.classList.add('text-gray-500'); // Apply the light gray color
                    } else {
                        reviewText.textContent = 'Failed to load review.';
                        reviewText.classList.add('text-gray-500'); // Apply the light gray color
                    }
                } catch (error) {
                    reviewText.textContent = 'Error loading review.';
                    reviewText.classList.add('text-gray-500'); // Apply the light gray color
                }
    
                reviewContentDiv.classList.remove('hidden');
                reviewLink.textContent = "hide review..."; // Update the link text
            } else {
                reviewContentDiv.classList.add('hidden');
                reviewLink.textContent = "see review..."; // Update the link text
            }
        }
    });
    
});
const checkFriendshipStatus = async (username, friendUsername) => {
    try {
        const response = await fetch(`/api/check-friendship-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, friendUsername })
        });
        const data = await response.json();
        if (data.success) {
            return data.status; // Expected to return 'friend', 'pending', or 'none'
        } else {
            console.error('Failed to check friendship status:', data.message);
            return 'none';
        }
    } catch (error) {
        console.error('Error checking friendship status:', error);
        return 'none';
    }
};
function renderNoUserFound() {
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = '<p class="text-red-600">No user found</p>';
}
