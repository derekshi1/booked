document.addEventListener('DOMContentLoaded', async () => {
    const username = localStorage.getItem('username');
    const userSection = document.getElementById('userSection');
    
   
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
        clearBookCards();

        // Fetch user library and display books
        try {
            const response = await fetch(`/api/library/${username}`);
            const data = await response.json();
            const libraryGrid = document.getElementById('libraryGrid');
            if (data.success && data.books.length > 0) {
                data.books.forEach(book => {
                    const bookDiv = document.createElement('div');
                    bookDiv.classList.add( 'relative', 'p-10', 'rounded-lg', 'shadow-lg', 'cursor-pointer', 'hover:shadow-2xl', 'transition', 'duration-300', 'ease-in-out');
                    bookDiv.innerHTML = `
                    <div class="relative group">
                         <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                        <img src="${book.thumbnail}" alt="${book.title}" class="w-full h-72 object-cover">
                        <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                            <h2 class="text-lg font-bold">${book.title}</h2>
                            <p class="text-gray-300">by ${book.authors}</p>
                        </div>
                        </a>
                        <button onclick="removeFromLibrary('${username}', '${book.isbn}')" class="absolute top-0 left-0 mt-2 ml-2 text-xs bg-red-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">Remove</button>
                    </div>
`;

                    libraryGrid.appendChild(bookDiv);
                });
            } else {
                libraryGrid.innerHTML = '<p>No books in your library.</p>';
            }
        } catch (error) {
            console.error('Error fetching user library:', error);
            document.getElementById('libraryGrid').innerHTML = '<p>Error loading library.</p>';
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
});

function clearBookCards() {
    const libraryGrid = document.getElementById('libraryGrid');
    libraryGrid.innerHTML = ''; // Clear all book cards
}

    
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