document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('username'); // Get the username from the URL
    const loggedInUsername = localStorage.getItem('username'); // Get the logged-in username

    // If no username is specified in the URL, use the logged-in username
    const username = profileUsername || loggedInUsername;

    if (username) {
        const booksLink = document.getElementById('booksLink');
        booksLink.href = `../html/library.html?username=${username}`;
        document.getElementById('usernameDisplay').textContent = username;
        const friendsLink = document.getElementById('friendsLink');
        friendsLink.href = `../html/friends.html?username=${username}`;
        if (username === loggedInUsername) {
            // Show the logout button if it's the user's own profile
            document.getElementById('logoutButton').style.display = 'inline-block';
            document.getElementById('logoutButton').addEventListener('click', () => {
                localStorage.removeItem('username');
                window.location.href = '../html/index.html';
            });
        } else {
            // Hide the logout button if viewing someone else's profile
            document.getElementById('logoutButton').style.display = 'none';

            // Check and display friendship status
            try {
                const response = await fetch('/api/check-friendship-status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username: loggedInUsername, friendUsername: username }),
                });

                const data = await response.json();

                if (data.success) {
                    const friendStatusSection = document.getElementById('friendStatusSection');

                    if (data.status === 'friend') {
                        friendStatusSection.innerHTML = `
                            <span class="friend-status-badge bg-green-700 text-white py-1 px-2 rounded-full text-sm flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Friends
                            </span>`;
                    } else if (data.status === 'pending') {
                        friendStatusSection.innerHTML = `
                            <span class="friend-status-badge bg-yellow-500 text-white py-1 px-2 rounded-full text-sm flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553 4.553M4 4l16 16" />
                                </svg>
                                Pending
                            </span>`;
                    } else {
                        friendStatusSection.innerHTML = `
                            <button id="addFriendButton" class="friend-status-badge bg-blue-700 text-white py-1 px-2 rounded-full text-sm flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                                Add Friend
                            </button>
                        `;

                        // Handle add friend button click
                        document.getElementById('addFriendButton').addEventListener('click', async () => {
                            try {
                                const addFriendResponse = await fetch('/api/add-friend', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ username: loggedInUsername, friendUsername: username }),
                                });

                                const addFriendData = await addFriendResponse.json();
                                if (addFriendData.success) {
                                    friendStatusSection.innerHTML = `
                                    <span class="friend-status-badge bg-yellow-500 text-white py-1 px-2 rounded-full text-sm flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553 4.553M4 4l16 16" />
                                        </svg>
                                        Pending
                                    </span>`;                                } else {
                                    alert('Failed to send friend request');
                                }
                            } catch (error) {
                                console.error('Error sending friend request:', error);
                                alert('Error sending friend request');
                            }
                        });
                    }
                } else {
                    console.error('Failed to check friendship status:', data.message);
                }
            } catch (error) {
                console.error('Error checking friendship status:', error);
            }
        }

        try {
            const response = await fetch(`/api/number-of-friends/${username}`);
            const data = await response.json();
            if (data.success) {
                document.getElementById('numberOfFriends').textContent = `${data.numberOfFriends}`;
            } else {
                console.error('Failed to fetch number of friends:', data.message);
            }
        } catch (error) {
            console.error('Error fetching number of friends:', error);
        }

        // Fetch library details
        try {
            const response = await fetch(`/api/library/${username}`);
            const data = await response.json();
            if (data.success) {
                document.getElementById('bookCount').textContent = `${data.totalBooks}`;
                document.getElementById('pageCount').textContent = `${data.totalPages}`;
                console.log('Library data:', data);

            } else {
                console.error('Failed to fetch library details:', data.message);
            }

            // Fetch top 5 books
            const top5Response = await fetch(`/api/library/top5/${username}`);
            const top5Data = await top5Response.json();
            const top5Grid = document.getElementById('top5Grid');
            let filledSlots = 0;

            if (top5Data.success) {
                const books = top5Data.top5;
                filledSlots = books.length;

                // Add existing books to top 5 grid
                books.forEach(book => {
                    const bookDiv = document.createElement('div');
                    bookDiv.classList.add('relative', 'p-6', 'rounded-lg', 'shadow-lg', 'cursor-pointer', 'hover:shadow-2xl', 'transition', 'duration-300', 'ease-in-out', 'bg-gray-800');
                    bookDiv.style.width = '200px';  // Set the desired width for the book card
                    bookDiv.style.height = '300px';
                    bookDiv.innerHTML = `
                        <div class="relative group h-full book-card">
                            <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group h-full">
                                <img src="${book.thumbnail}" alt="${book.title}" class="w-full h-full object-cover rounded-t-lg">
                                <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                                    <h2 class="text-lg font-bold">${book.title}</h2>
                                    <p class="text-gray-300">by ${book.authors}</p>
                                </div>
                            </a>
                            ${username === loggedInUsername ? `
                                <button onclick="removeFromTop5('${username}', '${book.isbn}')" class="absolute top-0 left-0 mt-2 ml-2 text-xs bg-red-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">Remove</button>
                            ` : ''}
                        </div>
                    `;
                    top5Grid.appendChild(bookDiv);
                });

                // Add empty placeholders for remaining slots
                for (let i = filledSlots; i < 5; i++) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.style.width = '200px';
                    emptyDiv.style.height = '300px';
                    emptyDiv.classList.add('relative', 'p-6', 'rounded-lg', 'shadow-lg', 'bg-gray-800', 'flex', 'items-center', 'justify-center');
                    emptyDiv.innerHTML = `
                        <div class="relative group w-full h-64 flex items-center justify-center">
                            <span class="text-white text-2xl">Empty Book</span>
                        </div>
                    `;
                    top5Grid.appendChild(emptyDiv);
                }
            } else {
                console.error('Failed to fetch top 5 books:', top5Data.message);
                // Add empty placeholders in case of an error
                const top5Grid = document.getElementById('top5Grid');
                for (let i = 0; i < 5; i++) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.style.width = '200px';
                    emptyDiv.style.height = '300px';
                    emptyDiv.classList.add('relative', 'p-6', 'rounded-lg', 'shadow-lg', 'bg-gray-800', 'flex', 'items-center', 'justify-center');
                    emptyDiv.innerHTML = `
                        <div class="relative group w-full h-64 flex items-center justify-center">
                            <span class="text-white text-2xl">Empty Book</span>
                        </div>
                    `;
                    top5Grid.appendChild(emptyDiv);
                }
            }
        } catch (error) {
            console.error('Error fetching top 5 books:', error);            
        }
    } else {
        window.location.href = '../html/login.html';
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('username'); // Get the username from the URL
    const loggedInUsername = localStorage.getItem('username'); // Get the logged-in username

    // New function to fetch and display genres
    async function pieChart() {
        try {
            const username = profileUsername || loggedInUsername;
            const response = await fetch(`/api/library/${username}`);
            const data = await response.json();
        
            if (data.success) {
                const categoryCounts = data.categoryCounts;

                // Prep the data for the chart
                const labels = Object.keys(categoryCounts);
                const values = Object.values(categoryCounts);

                const ctx = document.getElementById('categoryChart').getContext('2d');
                new Chart(ctx, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Books by Category',
                            data: values,
                            backgroundColor: [
                                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                            ]
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'top',                       
                            },
                            title: {
                                display: true,
                                text: 'Distribution of Books by Category'
                            }
                        }
                    }
                });
            } else {
                console.error('Failed to fetch category counts:', data.message);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }

    // Call the pieChart function
    pieChart();
});



async function removeFromTop5(username, isbn) {
    try {
        const response = await fetch('/api/library/top5/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, isbn }),
        });

        if (response.ok) {
            alert('Book removed from your top 5.');
            window.location.reload();
        } else {
            const error = await response.json();
            alert('Failed to remove book: ' + error.message);
        }
    } catch (error) {
        console.error('Error removing book from top 5:', error);
        alert('Error removing book from top 5.');
    }
}
