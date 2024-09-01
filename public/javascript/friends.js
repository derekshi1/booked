document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    const friendsTitle = document.getElementById('friendsTitle');
    friendsTitle.innerHTML = `<em>${username}</em>  friends!`;
    const friendsListContainer = document.getElementById('friendsListContainer');

    try {
        const response = await fetch(`/api/friends/${username}`);
        const data = await response.json();

        if (data.success) {
            friendsListContainer.innerHTML = '';

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
                friendCard.style.width = '800px'; // Set a specific width
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
                        <div class="stats-container flex space-x-8">
                            <div class="stats-item text-center">
                            <p class="stats-value text-white font-bold" style="font-size: 30px;">${libraryData.totalBooks || 0}</p>
                            <span class="stats-label text-gray-400" style="font-size: 14px;">Books</span>
                        </div>
                        <div class="stats-item text-center">
                            <p class="stats-value text-white font-bold" style="font-size: 30px;">${libraryData.totalPages || 0}</p>
                            <span class="stats-label text-gray-400" style="font-size: 14px;">Pages</span>
                        </div>
                        <div class="stats-item text-center">
                            <p class="stats-value text-white font-bold" style="font-size: 30px;">${friendsCountData.numberOfFriends || 0}</p>
                            <span class="stats-label text-gray-400" style="font-size: 14px;">Friends</span>
                        </div>

                        </div>
                    `;
                friendsListContainer.appendChild(friendCard);
            }
        } else {
            console.error('Failed to fetch friends:', data.message);
            friendsListContainer.innerHTML = '<p class="text-white">No friends found.</p>';
        }
    } catch (error) {
        console.error('Error fetching friends:', error);
        friendsListContainer.innerHTML = '<p class="text-white">Error loading friends.</p>';
    }
});
