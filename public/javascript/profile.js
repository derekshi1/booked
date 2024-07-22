document.addEventListener('DOMContentLoaded', async () => {
    const username = localStorage.getItem('username');
    if (username) {
        document.getElementById('usernameDisplay').textContent = username;
        document.getElementById('logoutButton').addEventListener('click', () => {
            localStorage.removeItem('username');
            window.location.href = '../html/index.html';
        });

        // Fetch library details
        try {
            const response = await fetch(`/api/library/${username}`);
            const data = await response.json();
            if (data.success) {
                document.getElementById('bookCount').textContent = `${data.totalBooks}`;
                document.getElementById('pageCount').textContent = `${data.totalPages}`;
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
                        <div class="relative group h-full">
                            <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group h-full">
                                <img src="${book.thumbnail}" alt="${book.title}" class="w-full h-full object-cover rounded-t-lg">
                                <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                                    <h2 class="text-lg font-bold">${book.title}</h2>
                                    <p class="text-gray-300">by ${book.authors}</p>
                                </div>
                            </a>
                            <button onclick="removeFromTop5('${username}', '${book.isbn}')" class="absolute top-0 left-0 mt-2 ml-2 text-xs bg-red-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">Remove</button>
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
