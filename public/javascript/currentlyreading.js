document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const username = urlParams.get('username');
    const currentlyReadingGrid = document.getElementById('currentlyReadingGrid');

    console.log('Loaded script.'); // Debugging start
    console.log('Username from URL params:', username);

    if (!username) {
        alert('No username provided. Please log in.');
        return;
    }

    try {
        // Fetch the list of friends for the logged-in user
        console.log('Fetching friends for user:', username);
        const friendsResponse = await fetch(`/api/friends/${username}`);
        const friendsData = await friendsResponse.json();
        console.log('Friends data fetched:', friendsData);

        if (!friendsData.success || !friendsData.friends || friendsData.friends.length === 0) {
            console.log('No friends found for user:', username);
            currentlyReadingGrid.innerHTML = '<p class="text-center col-span-full">Your friends list is empty.</p>';
            return;
        }

        const friends = friendsData.friends; // Array of friends' usernames
        console.log('Friends list:', friends);

        // Loop through each friend and fetch their Currently Reading books
        const bookCovers = [];
        for (const friend of friends) {
            console.log(`Fetching currently reading for friend: ${friend.username}`);
            const response = await fetch(`/api/library/${friend.username}/currently-reading`);
            const currentlyReadingData = await response.json();
            console.log(`Currently reading data for ${friend.username}:`, currentlyReadingData);

            if (currentlyReadingData.success && currentlyReadingData.currentlyReading.length > 0) {
                // Extract book thumbnails from the currently reading list
                currentlyReadingData.currentlyReading.forEach(book => {
                    if (book.thumbnail) {
                        console.log(`Adding book to display: ${book.title}`);
                        bookCovers.push({
                            username: friend.username,
                            thumbnail: book.thumbnail,
                            title: book.title,
                            startDate: book.startDate
                        });
                    } else {
                        console.log(`Book without thumbnail skipped: ${book.title}`);
                    }
                });
            } else {
                console.log(`No currently reading books found for friend: ${friend.username}`);
            }
        }

        // Render the book covers in the grid
        console.log('Books to render:', bookCovers);
        if (bookCovers.length > 0) {
            bookCovers.forEach(book => {
                console.log("book date:", book.startDate)
                const bookElement = document.createElement('div');
                bookElement.className = 'flex flex-col items-center mt-6'; 
                bookElement.innerHTML = `
                    <a href="../html/book.html?isbn=${book.isbn}" class="relative group book-card block">
                        <img src="${book.thumbnail}" alt="${book.title}" class="w-48 h-72 object-cover rounded-t-lg">
                        <div class="absolute bottom-0 left-0 right-0 bg-gray-900 bg-opacity-75 text-white text-sm text-center p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>${book.title}</span>
                            <br>
                            <span class="text-xs">Currently read by: ${book.username}</span>
                        </div>
                    </a>

                    <div class="text-center mt-4">
                        <p class="text-gray-100 font-large">Read by: <em>${book.username}</em></p> <!-- Username -->
                        <p class="text-gray-500 text-xs">Since: ${new Date(book.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>
                `;
                currentlyReadingGrid.appendChild(bookElement);
            });
        } else {
            console.log('No books to display.');
            currentlyReadingGrid.innerHTML = '<p class="text-center text-gray-300 col-span-full">Your friends have nothing in their Currently Reading list.</p>';
        }
    } catch (error) {
        console.error('Error fetching currently reading books:', error);
        currentlyReadingGrid.innerHTML = '<p class="text-center col-span-full text-red-500">Error loading data. Please try again later.</p>';
    }

    function formatDate(isoDate) {
        if (!isoDate) return 'Unknown date'; // Handle missing dates
    
        const date = new Date(isoDate); // Parse the ISO string
        const options = { year: 'numeric', month: 'long', day: 'numeric' }; // Formatting options
        return date.toLocaleDateString(undefined, options); // Return formatted date
    }
});
