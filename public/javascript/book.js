document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const isbn = params.get('isbn');
    const bookDetails = document.getElementById('bookDetails');
    const username = localStorage.getItem('username');
    const userSection = document.getElementById('userSection');

// Function to remove book from library
async function removeFromLibrary(username, isbn) {
    try {
        const response = await fetch('/api/library/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, isbn }),
        });

        if (response.ok) {
            alert('Book removed from your library.');
            window.location.href = '../html/library.html';
        } else {
            const error = await response.json();
            alert('Failed to remove book: ' + error.message);
        }
    } catch (error) {
        console.error('Error removing book from library:', error);
        alert('Error removing book from library.');
    }
}


    // Ensure the home button is always present
    if (!document.querySelector('#homeButton')) {
        const homeButton = document.createElement('a');
        homeButton.id = 'homeButton';
        homeButton.href = '../html/index.html';
        homeButton.className = 'ml-4 text-white bg-green-900 px-4 py-2 rounded';
        homeButton.textContent = 'Home';
        userSection.appendChild(homeButton);
    }

    if (username) {
        if (!document.querySelector('#libraryButton')) {
            const libraryButton = document.createElement('a');
            libraryButton.id = 'libraryButton';
            libraryButton.href = '../html/library.html';
            libraryButton.className = 'ml-4 text-white bg-green-900 px-4 py-2 rounded';
            libraryButton.textContent = 'Library';
            userSection.appendChild(libraryButton);
        }

        if (!document.querySelector('#usernameSpan')) {
            const usernameSpan = document.createElement('span');
            usernameSpan.id = 'usernameSpan';
            usernameSpan.className = 'ml-4 text-green-900 handwriting-font cursor-pointer';
            usernameSpan.textContent = username;
            usernameSpan.addEventListener('click', () => {
                window.location.href = '../html/profile.html';
            });
            userSection.appendChild(usernameSpan);
        }
    } else {
        if (!document.querySelector('#loginButton')) {
            const loginButton = document.createElement('a');
            loginButton.id = 'loginButton';
            loginButton.href = '../html/login.html';
            loginButton.className = 'text-white bg-green-900 px-4 py-2 rounded';
            loginButton.textContent = 'Login';
            userSection.appendChild(loginButton);
        }
    }

    if (isbn) {
        try {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
            const data = await response.json();
            const book = data.items[0].volumeInfo;

            bookDetails.innerHTML = `
                <div class="flex flex-col md:flex-row">
                    <img src="${book.imageLinks ? book.imageLinks.thumbnail : 'https://via.placeholder.com/128x192?text=No+Image'}" alt="${book.title}" class="w-64 h-96 object-cover mr-8 mb-8 md:mb-0">
                    <div>
                        <h1 class="text-4xl font-bold mb-4">${book.title}</h1>
                        <h2 class="text-2xl mb-4">by ${book.authors ? book.authors.join(', ') : 'Unknown'}</h2>
                        <p class="text-xl mb-4"><strong>Published:</strong> ${book.publishedDate}</p>
                        <p class="text-xl mb-4"><strong>Pages:</strong> ${book.pageCount}</p>
                        <p class="text-xl mb-4"><strong>Publisher:</strong> ${book.publisher}</p>
                        <p class="text-xl mb-4"><strong>Categories:</strong> ${book.categories ? book.categories.join(', ') : 'None'}</p>
                        <p class="text-xl mb-4"><strong>Average Rating:</strong> ${book.averageRating ? book.averageRating : 'N/A'} (${book.ratingsCount ? book.ratingsCount : 0} ratings)</p>
                        <p class="text-xl mb-4">${book.description ? book.description : 'No description available'}</p>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Error fetching book details:', error);
            bookDetails.innerHTML = '<p>Error loading book details.</p>';
        }
       // Add event listener to the remove button
       document.getElementById('removeFromLibrary').addEventListener('click', () => {
        removeFromLibrary(username, isbn);
    });

} else {
    userSection.innerHTML = `
        <a href="../html/login.html" class="text-white bg-green-900 px-4 py-2 rounded">Login</a>
    `;
    document.getElementById('bookDetails').innerHTML = '<p>Please log in to see book details and manage your library.</p>';
}
});
