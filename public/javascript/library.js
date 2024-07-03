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
        // Fetch user library and display books
        try {
            const response = await fetch(`/api/library/${username}`);
            const data = await response.json();
            const libraryGrid = document.getElementById('libraryGrid');
            if (data.success && data.books.length > 0) {
                data.books.forEach(book => {
                    const bookDiv = document.createElement('div');
                    bookDiv.classList.add('bg-white', 'rounded', 'shadow-lg', 'p-4');
                    bookDiv.innerHTML = `
                        <img src="${book.thumbnail}" alt="${book.title}" class="w-full h-64 object-cover mb-4">
                        <h2 class="text-lg font-bold">${book.title}</h2>
                        <p class="text-gray-700">by ${book.authors}</p>
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
        userSection.innerHTML += `
            <a href="../html/login.html" class="text-white bg-green-900 px-4 py-2 rounded">Login</a>
        `;
    }
});
