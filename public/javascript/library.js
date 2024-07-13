document.addEventListener('DOMContentLoaded', async () => {
    const username = localStorage.getItem('username');
    const userSection = document.getElementById('userSection');
    const modal = document.getElementById('reviewModal');
    const closeModal = document.getElementById('closeModal');
    const ratingInput = document.getElementById('rating');
    const ratingValue = document.getElementById('ratingValue');

    if (username) {
        
        clearBookCards();

        // Fetch user library and display books
        try {
            const response = await fetch(`/api/library/${username}`);
            const data = await response.json();
            const libraryGrid = document.getElementById('libraryGrid');
            libraryGrid.className = 'library-container'; // Apply library-container class
            if (data.success && data.books.length > 0) {
                data.books.forEach(book => {
                    const bookDiv = document.createElement('div');
                    bookDiv.classList.add('library-card', 'relative', 'p-6', 'rounded-lg', 'shadow-lg', 'cursor-pointer', 'hover:shadow-2xl', 'transition', 'duration-300', 'ease-in-out');
                    bookDiv.innerHTML = `
                        <div class="relative group">
                            <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                                <img src="${book.thumbnail}" alt="${book.title}" class="w-full h-64 object-cover rounded-t-lg">
                                <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                                    <h2 class="text-lg font-bold">${book.title}</h2>
                                    <p class="text-gray-300">by ${book.authors}</p>
                                </div>
                            </a>
                            <button onclick="removeFromLibrary('${username}', '${book.isbn}')" class="absolute top-0 left-0 mt-2 ml-2 text-xs bg-red-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">Remove</button>
                            <button class="comment-button absolute top-0 right-0 mt-2 mr-2 text-xs bg-blue-500 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out"onclick="showReviewPopup('${book.isbn}', '${book.title}')"></button>
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

        document.getElementById('saveReview').addEventListener('click', async () => {
            const reviewText = document.getElementById('reviewText').value;
            const rating = ratingInput.value;
            const bookIsbn = modal.dataset.isbn;
            const username = localStorage.getItem('username');
            console.log('Username:', username);
            console.log('ISBN:', bookIsbn);


            try {
                const response = await fetch('/api/library/review', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ username, isbn: bookIsbn, review: reviewText, rating }),
                });

                if (response.ok) {
                    alert('Review saved successfully.');
                    window.location.href = '../html/library.html';
                } else {
                    const error = await response.json();
                    alert('Failed to save review: ' + error.message);
                }
            } catch (error) {
                console.error('Error saving review:', error);
                alert('Error saving review.');
            }

            modal.style.display = 'none';
        });
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
    
    closeModal.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    ratingInput.addEventListener('input', (event) => {
        ratingValue.textContent = event.target.value;
    });
});

// Function to show the review popup
async function showReviewPopup(bookIsbn, bookTitle) {
    const modal = document.getElementById('reviewModal');
    const username = localStorage.getItem('username');
    modal.dataset.isbn = bookIsbn; // Set the bookIsbn in the modal's dataset
    modal.querySelector('h2').textContent = `Review for ${bookTitle}`;

    try {
        const response = await fetch(`/api/library/review/${username}/${bookIsbn}`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('reviewText').value = data.review || '';
            document.getElementById('rating').value = data.rating || 0;
            document.getElementById('ratingValue').textContent = data.rating || 0;
        } else {
            document.getElementById('reviewText').value = '';
            document.getElementById('rating').value = 0;
            document.getElementById('ratingValue').textContent = 0;
        }
    } catch (error) {
        console.error('Error fetching book review:', error);
        document.getElementById('reviewText').value = '';
        document.getElementById('rating').value = 0;
        document.getElementById('ratingValue').textContent = 0;
    }

    modal.style.display = 'block';
}


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
