document.addEventListener('DOMContentLoaded', async () => { 
    const searchFriendInput = document.getElementById('searchFriendInput');
    const searchFriendButton = document.getElementById('searchFriendButton');
    const searchResults = document.getElementById('searchResults');
    const activitiesFeed = document.getElementById('activitiesFeed');
    const clearSearchButton = document.getElementById('clearSearchButton');
    const username = localStorage.getItem('username');
    const searchInput = document.getElementById('searchFriendInput');
    const clearButton = document.getElementById('clearSearchButton');
    const reviewsButton = document.getElementById('reviewsSection');
    const subheaderButtons = document.querySelectorAll("nav button");
    const currentlyReadingButton = document.getElementById('currentlyReadingSection')


    searchInput.addEventListener('input', () => {
        clearButton.style.display = searchInput.value ? 'block' : 'none';
    });

    clearButton.addEventListener('click', () => {
        searchInput.value = '';
        clearButton.style.display = 'none';
    });
    await updateSocialTabNotification();
    const socialTabClicked = sessionStorage.getItem('socialTabClicked') === 'true';  // Check if tab was clicked

    let socialLinkClickedAway = false;  // Flag to check if user clicked away

    const socialLink = document.getElementById('socialTab');  // Get the social tab element

    const friendsButton = document.getElementById("friendsSection");

    // Add a click event listener to the button
    friendsButton.addEventListener("click", function() {
        // Redirect to friends.html with the username as a query parameter
        window.location.href = `friends.html?username=${encodeURIComponent(username)}`;
    });
    currentlyReadingButton.addEventListener("click", function() {
        // Redirect to friends.html with the username as a query parameter
        window.location.href = `currentlyreading.html?username=${encodeURIComponent(username)}`;
    });    
    reviewsButton.addEventListener("click", function() {
        // Redirect to friends.html with the username as a query parameter
        window.location.href = `social.html?username=${encodeURIComponent(username)}`;
    });
    

    if (window.location.pathname.includes('social.html')) {
        if (socialTabClicked) {
            console.log('Social tab was clicked from another page, waiting for user to click away.');

            // Add a listener to detect when the user clicks away from the social tab
            document.addEventListener('click', async (event) => {
                event.stopPropagation();
    
                // Ensure the user clicked outside the social tab and that it hasn't been triggered already
                if (!socialLink.contains(event.target) && !socialLinkClickedAway) {
                    console.log('User clicked away from the social tab. Marking activities as read.');
    
                    await markAllActivitiesAsRead();
                    await updateSocialTabNotification();
    
                    // Remove red outline from unread activities (example of red outline removal)
                    const activityItems = document.querySelectorAll('.activity-item');  // Adjust the selector based on your structure
                    activityItems.forEach(item => {
                        item.classList.remove('unread');  // Assuming 'unread' class gives the red outline
                    });
    
                    // Set flag to prevent multiple triggers
                    socialLinkClickedAway = true;
    
                    // Clear the session storage flag
                    sessionStorage.removeItem('socialTabClicked');
                }
            });
    
            socialLink.addEventListener('click', (event) => {
                event.stopPropagation();  // Prevents the click event on socialLink from bubbling up
            });
        }
    }
    
    async function updateSocialTabNotification() {
        try {
            const username = localStorage.getItem('username');
            if (!username) return;
    
            const response = await fetch(`/api/activities/unread-count/${username}`);
            const data = await response.json();
    
            const notificationBadge = document.getElementById('notificationBadge');
    
            if (data.success) {
                const unreadCount = data.unreadCount;
                console.log("Notification number:", unreadCount);
    
                if (unreadCount > 0) {
                    // Show the notification badge with the unread count
                    notificationBadge.textContent = unreadCount;
                    notificationBadge.style.display = 'inline-block';  // Ensure badge is shown
                } else {
                    // Hide the notification badge if there are no unread notifications
                    notificationBadge.style.display = 'none';  // Hide badge if there are no unread notifications
                }
            }
        } catch (error) {
            console.error('Error fetching unread notifications:', error);
        }
    }

    // Function to mark all activities as read
    async function markAllActivitiesAsRead() {
        try {
            const username = localStorage.getItem('username');
            if (!username) return;
            console.log('markAllActivitiesAsRead called'); // Log when the function is called
    
            const response = await fetch(`/api/activities/mark-read/${username}`, {
                method: 'POST'
            });
    
            if (response.ok) {
                console.log('All activities marked as read');
            }
        } catch (error) {
            console.error('Error marking activities as read:', error);
        }
    }

    
    
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
        console.log('All activities received:', activities);
       
        // Filter for only reviews and library additions, and remove duplicates
        const seenActivities = new Set();
        const uniqueActivities = activities.filter(activity => {
            const activityKey = `${activity.username}-${activity.action}-${activity.bookTitle}`;
            const isRelevantAction = activity.action.includes('reviewed') || activity.action.includes('added to library');
            
            if (!seenActivities.has(activityKey) && isRelevantAction) {
                // Log each activity that passes the filter
                console.log('Processing activity:', {
                    username: activity.username,
                    action: activity.action,
                    bookTitle: activity.bookTitle,
                    review: activity.review,
                    rating: activity.rating,
                    visibility: activity.visibility,
                    timestamp: activity.timestamp
                });
                seenActivities.add(activityKey);
                return true;
            }
            return false;
        });

        console.log('Filtered unique activities:', uniqueActivities);

        // Sort activities by timestamp in descending order (most recent first)
        uniqueActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        activitiesFeed.innerHTML = '';

        // Create container for all activities
        const activitiesContainer = document.createElement('div');
        activitiesContainer.classList.add('space-y-4');

        uniqueActivities.forEach(async (activity) => {
            // Log detailed information about each activity being rendered
            console.log('Rendering activity:', {
                type: activity.action.includes('reviewed') ? 'review' : 'library addition',
                username: activity.username,
                bookTitle: activity.bookTitle,
                reviewData: {
                    review: activity.review,
                    rating: activity.rating,
                    visibility: activity.visibility
                },
                rawActivity: activity // Log the entire activity object
            });

            const activityElement = document.createElement('div');
            activityElement.classList.add(
                'activity',
                'p-6',
                'bg-white',
                'rounded-xl',
                'shadow-md',
                'mb-4',
                'border',
                'border-gray-100',
                'hover:shadow-lg',
                'transition-shadow',
                'duration-200'
            );

            let activityContent;
            const isReview = activity.action.includes('reviewed');
            let reviewVisibility = activity.visibility || 'public'; // Default to public if undefined
                let canViewReview = false;

                if (reviewVisibility === 'public') {
                    canViewReview = true;
                } else if (reviewVisibility === 'friends') {
                    const friendshipStatus = await checkFriendshipStatus(localStorage.getItem('username'), activity.username);
                    if (friendshipStatus === 'friend') {
                        canViewReview = true;
                    }
                } else if (reviewVisibility === 'private') {
                    if (localStorage.getItem('username') === activity.username) {
                        canViewReview = true;
                    }
                }

            if (isReview && canViewReview) {
                // Log review-specific data before rendering
                console.log('Rendering review activity:', {
                    username: activity.username,
                    bookTitle: activity.bookTitle,
                    review: activity.review,
                    rating: activity.rating,
                    visibility: activity.visibility
                });

                activityContent = `
                    <div class="flex items-start space-x-4">
                        <div class="flex-grow">
                            <div class="flex items-center space-x-2 mb-3">
                                <a href="../html/profile.html?username=${activity.username}" 
                                   class="text-blue-600 hover:text-blue-800 font-semibold">
                                    ${activity.username}
                                </a>
                                <span class="text-gray-400">•</span>
                                <span class="text-gray-500 text-sm">${formatTimeAgo(activity.timestamp)}</span>
                            </div>
                            
                            <div class="flex items-center mb-3">
                                <a href="../html/book.html?isbn=${activity.isbn}" 
                                   class="text-lg font-medium text-gray-900 hover:text-gray-700">
                                    ${activity.bookTitle}
                                </a>
                                <div class="ml-2 px-2 py-1 bg-green-50 rounded-full">
                                    <span class="text-green-800 text-sm font-medium">
                                        ${activity.rating !== undefined ? activity.rating : 'No rating'}/100
                                    </span>
                                </div>
                            </div>

                                    ${activity.review ? `
                                        <div class="bg-gray-50 p-4 rounded-lg mb-3">
                                            <p class="text-gray-700 text-sm leading-relaxed">
                                                "${activity.review}"
                            </p>
                        </div>
                            ` : '<div class="text-gray-500 text-sm">No review provided</div>'}

                                    <div class="flex items-center space-x-4 text-sm text-gray-500">
                                        <span class="flex items-center">
                                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z">
                                                </path>
                                            </svg>
                                            ${activity.likes || 0} likes
                                        </span>
                                        <span class="flex items-center">
                                            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                                      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z">
                                                </path>
                                            </svg>
                                            ${activity.comments || 0} comments
                                        </span>
                                    </div>
                        </div> 
                                
                                <div class="flex-shrink-0">
                                    <img src="${activity.thumbnail}" 
                                         alt="${activity.bookTitle}" 
                                         class="w-20 h-28 object-cover rounded-lg shadow-sm">
                            </div>
                         </div>
                    `;
                    } else if (!isReview) {
                        // Library addition activity
                        activityContent = `
                            <div class="flex items-start space-x-4">
                                <div class="flex-grow">
                                    <div class="flex items-center space-x-2 mb-3">
                                        <a href="../html/profile.html?username=${activity.username}" 
                                           class="text-blue-600 hover:text-blue-800 font-semibold">
                                            ${activity.username}
                                        </a>
                                        <span class="text-gray-400">•</span>
                                        <span class="text-gray-500 text-sm">${formatTimeAgo(activity.timestamp)}</span>
                                    </div>
                                    
                                    <div class="flex items-center">
                                        <span class="text-gray-700">added</span>
                                        <a href="../html/book.html?isbn=${activity.isbn}" 
                                           class="ml-2 text-lg font-medium text-gray-900 hover:text-gray-700">
                                            ${activity.bookTitle}
                                        </a>
                                        <span class="text-gray-700 ml-2">to their library</span>
                                    </div>
                                </div>
                                
                                <div class="flex-shrink-0">
                                    <img src="${activity.thumbnail}" 
                                         alt="${activity.bookTitle}" 
                                         class="w-20 h-28 object-cover rounded-lg shadow-sm">
                                </div>
                            </div>
                        `;
                    } else {
                        // Private review
                        activityContent = `
                            <div class="flex items-start space-x-4">
                                <div class="flex-grow">
                                    <div class="flex items-center space-x-2 mb-3">
                                        <a href="../html/profile.html?username=${activity.username}" 
                                           class="text-blue-600 hover:text-blue-800 font-semibold">
                                            ${activity.username}
                                        </a>
                                        <span class="text-gray-400">•</span>
                                        <span class="text-gray-500 text-sm">${formatTimeAgo(activity.timestamp)}</span>
                                    </div>
                                    
                                    <div class="flex items-center text-gray-500">
                                        <span>privately reviewed</span>
                                        <a href="../html/book.html?isbn=${activity.isbn}" 
                                           class="ml-2 text-gray-700 hover:text-gray-900 font-medium">
                                            ${activity.bookTitle}
                                        </a>
                                    </div>
                                </div>
                                
                                <div class="flex-shrink-0">
                                    <img src="${activity.thumbnail}" 
                                         alt="${activity.bookTitle}" 
                                         class="w-20 h-28 object-cover rounded-lg shadow-sm opacity-50">
                                </div>
                            </div>
                        `;
                    }

                    activityElement.innerHTML = activityContent;
                    activitiesContainer.appendChild(activityElement);
                });

                activitiesFeed.appendChild(activitiesContainer);
            };
            
            
            const renderAdditionalActivities = async (activities, containerElement, seeMoreLink) => {
                // Sort activities by timestamp in descending order (most recent first)
                activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
                // Clear any previously added additional activities
                containerElement.querySelectorAll('.additional-activity').forEach(activityEl => activityEl.remove());
            
                // Add up to 4 more activities
                const limit = 4;
                activities.slice(0, limit).forEach(async (activity) => {
                    const additionalActivityElement = document.createElement('div');
                    additionalActivityElement.classList.add('activity', 'p-2', 'bg-gray-50', 'rounded', 'shadow', 'mb-2', 'ml-4', 'additional-activity');
            
                    let activityContent;
                    let canViewReview = false; // Initialize canViewReview for scope
            
                    if (activity.action.includes("became friends with")) {
                        // Activity related to friendship
                        activityContent = `
                                <div class="activity flex justify-between items-center ${activity.isRead ? '' : 'unread'}">
                            <div>
                                <a href="../html/profile.html?username=${activity.username}" class="text-blue-500 hover:underline hover:font-bold">
                                    <strong>${activity.username}</strong>
                                </a> 
                                ${activity.action}
                                <a href="../html/profile.html?username=${activity.bookTitle}" class="text-blue-500 hover:underline hover:font-bold">
                                    ${activity.bookTitle}
                                </a>
                            </div>
                            <p class="time-ago text-gray-600 text-xs">${formatTimeAgo(activity.timestamp)}</p>
                            </div>
                        `;
                    } else {
                        // Activity related to books
                        let reviewVisibility = activity.visibility;
                        console.log(`Review visibility for activity: ${reviewVisibility}`);
            
                        // Check visibility conditions
                        if (reviewVisibility === 'public') {
                            canViewReview = true; // Public reviews can be seen by everyone
                        } else if (reviewVisibility === 'friends') {
                            const friendshipStatus = await checkFriendshipStatus(localStorage.getItem('username'), activity.username);
                            if (friendshipStatus === 'friend') {
                                canViewReview = true;
                            }
                        } else if (reviewVisibility === 'private') {
                            // Private reviews can only be seen by the review author
                            if (localStorage.getItem('username') === activity.username) {
                                canViewReview = true;
                            }
                        }
            
                        if (canViewReview) {
                            activityContent = `
                                <div class="activity flex justify-between items-center ${activity.isRead ? '' : 'unread'}">
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
                        } else {
                            // If the user cannot view the review, show a message instead
                            activityContent = `
                                <div class="activity flex justify-between items-center ${activity.isRead ? '' : 'unread'}">
                                    <div>
                                        privately reviewed 
                                        <a href="../html/book.html?isbn=${activity.isbn}" class="text-gray-500 hover:text-gray-800 hover:font-bold">
                                            <em>${activity.bookTitle}</em>
                                        </a>
                                    </div>
                                    <div class="relative">
                                        <img src="${activity.thumbnail}" alt="${activity.bookTitle}" class="w-16 h-24 object-cover rounded ml-4">
                                    </div>
                                </div>
                                 <div class="flex justify-between items-end mt-2">
                                    <p class="time-ago text-gray-600 text-xs">${formatTimeAgo(activity.timestamp)}</p>
                                 </div>
                            `;
                        }
                    }
            
                    additionalActivityElement.innerHTML = activityContent;
                    containerElement.appendChild(additionalActivityElement);
                });
            
                seeMoreLink.textContent = 'See less actions...';
            
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
                const remainingActions = Math.min(totalActivities - 1, 4); // Only show "See 4 more actions..."
            
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
                
                const limit = 4; // Limit for additional activities
            
                // Display the additional activities
                renderAdditionalActivities(activities.slice(1, limit + 1), seeMoreLink.closest('.activity'), seeMoreLink);
            
                // Change the link text to "See less actions"
                seeMoreLink.textContent = 'See less actions';
            
                // Update event listener to handle "See less" click
                seeMoreLink.removeEventListener('click', handleSeeMoreClick);
                seeMoreLink.addEventListener('click', handleSeeLessClick);
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
                try {
                    const response = await fetch(`/api/friends-activities/${username}`);
                    if (!response.ok) {
                        throw new Error(`Error fetching activities: ${response.statusText}`);
                    }
            
                    const data = await response.json();
                    if (data.success) {
                        console.log('Raw activities data from API:', data.activities);
                        
                        // Log a sample activity if available
                        if (data.activities.length > 0) {
                            console.log('Sample activity structure:', {
                                firstActivity: data.activities[0],
                                hasReview: 'review' in data.activities[0],
                                hasRating: 'rating' in data.activities[0],
                                propertyNames: Object.keys(data.activities[0])
                            });
                        }

                        renderActivitiesFeed(data.activities);
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
                const titleElement = document.createElement('h2');
                titleElement.classList.add('text-2xl', 'text-white', 'font-bold', 'mb-4');
                titleElement.textContent = 'Your Friend Requests';
                friendRequestsContainer.appendChild(titleElement)
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
