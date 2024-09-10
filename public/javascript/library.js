document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('username'); // Get the username from the URL
    const loggedInUsername = localStorage.getItem('username'); // Get the logged-in username
    const modal = document.getElementById('reviewModal');
    const closeModal = document.getElementById('closeModal');
    const ratingInput = document.getElementById('rating');
    const ratingValue = document.getElementById('ratingValue');
    const saveReviewButton = document.getElementById('saveReview');
    const sortOptions = document.getElementById('sortOptions');
    let booksData = []; // Store fetched books data here
    const sortLabel = document.getElementById('sortLabel'); // Reference to the sort label

    let currentRating = 0;
    let currentPage = 1; // Track the current page
    const limit = 16; // Number of books per page
   
    const username = profileUsername || loggedInUsername;

    const isOwnLibrary = username === loggedInUsername;
    const libraryTitle = document.getElementById('libraryTitle');
    if (!isOwnLibrary) {
        // Hide sort options and review modal for someone else's library
        if (sortOptions) sortOptions.style.display = 'none';
        if (saveReviewButton) saveReviewButton.style.display = 'none';
        sortLabel.textContent = ""; // Hide the label if viewing someone else's library
        if (sortOptions) sortOptions.style.display = 'none';
        if (saveReviewButton) saveReviewButton.style.display = 'none';
        libraryTitle.innerHTML = `<em>${username}'s Library</em>  `;
    } else {
        sortLabel.textContent = "Sort by:"; // Set the label text if viewing your own library
        sortOptions.addEventListener('change', async (event) => {
            const sortBy = event.target.value;
            currentPage = 1;
            await fetchAndDisplayBooks(sortBy, currentPage);
        });
        libraryTitle.innerHTML = `<em>Your Library</em>  `;

    }
   

    async function fetchAndDisplayBooks(sortBy = 'none', page = 1) {
        try {

            let url = `/api/library/${username}/books?page=${page}&limit=${limit}&loggedInUsername=${loggedInUsername}`;
            if (sortBy !== 'none' && isOwnLibrary) {
                url += `&sortBy=${sortBy}`;
            }
            console.log(`API Request URL: ${url}`);

            const response = await fetch(url);
            const data = await response.json();
            console.log(`[FETCH BOOKS] Response:`, data); // Log response from the server

            if (data.success && data.books.length > 0) {
                console.log(`Fetched ${data.books.length} books for page ${page}`);

                booksData = data.books; // Store the fetched books data
                renderBooks(data.books, sortBy, page, limit);
                updatePaginationControls(data.currentPage, data.totalPages); // Update pagination controls
            } else {
                addPlaceholderCards(libraryGrid, "Empty Book");
            }
        } catch (error) {
            console.error('Error fetching books:', error);
            document.getElementById('libraryGrid').innerHTML = '<p>Error loading library.</p>';
        }
    }
    await fetchAndDisplayBooks('none', currentPage);

    function updatePaginationControls(currentPage, totalPages) {    
        const prevPageBtn = document.getElementById('prevPage');
        const nextPageBtn = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');
    
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    
        prevPageBtn.onclick = () => {
            if (currentPage > 1) {
                fetchAndDisplayBooks('none', currentPage - 1);  // Move to the previous page
            }
        };
    
        nextPageBtn.onclick = () => {
            if (currentPage < totalPages) {
                fetchAndDisplayBooks('none', currentPage + 1);  // Move to the next page
            }
        };
    }
    
    
    async function renderBooks(books, sortBy, page = 1, limit = 16) {
        const libraryGrid = document.getElementById('libraryGrid');
        libraryGrid.innerHTML = ''; // Clear the grid before rendering new content
        libraryGrid.className = 'library-container'; // Apply library-container class

        console.log(`[RENDER BOOKS] Rendering ${books.length} books for page ${page}`); // Add this log

        // Calculate the start and end indices for the current page
        
        // Slice the books array to only get the books for the current page
    
        books.forEach(book => {
            console.log(`Rendering book `, book);  // Add this to verify the book data

            const bookDiv = document.createElement('div');
            bookDiv.classList.add('library-card', 'relative', 'p-6', 'rounded-lg', 'shadow-lg', 'cursor-pointer', 'hover:shadow-2xl', 'transition', 'duration-300', 'ease-in-out');
            
            let additionalInfo = ''; // This will store either the review date or rating
            if (sortBy === 'reviewDate' && isOwnLibrary) {
                additionalInfo = `<p class="text-gray-500 text-sm">Reviewed on: ${book.reviewDate ? new Date(book.reviewDate).toLocaleString() : 'No Review Date'}</p>`;
            } else if (sortBy === 'rating' && isOwnLibrary) {
                additionalInfo = `<p class="text-gray-500 text-sm">Rating: ${book.rating || 'N/A'}</p>`;
            }
    
            bookDiv.innerHTML = `
                <div class="relative group book-card library-card" style="border: 4px solid ${getGradientColor(book.rating)};">
                    <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                        <img src="${book.thumbnail}" alt="${book.title}" class="w-full h-full object-cover rounded-t-lg">
                        <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                            <h2 class="text-lg font-bold">${book.title}</h2>
                            <p class="text-gray-300">by ${book.authors}</p>
                        </div>
                    </a>
                    ${additionalInfo} <!-- Display either review date or rating -->
                    ${isOwnLibrary || !isOwnLibrary ? `<button class="comment-button ease-in-out-transition absolute top-0 right-0 mt-2 mr-2 text-xs bg-blue-500 text-white px-2 py-1 rounded" data-isbn="${book.isbn}" data-title="${book.title}"></button>` : ''}
                    ${isOwnLibrary ? `<button class="comment-button ease-in-out-transition absolute top-0 right-0 mt-2 mr-2 text-xs bg-blue-500 text-white px-2 py-1 rounded" data-isbn="${book.isbn}" data-title="${book.title}"></button>` : ''}
                    <button onclick="removeFromReadingList('${username}', '${book.isbn}')" class="absolute top-0 left-0 mt-2 ml-2 text-xs bg-red-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">Remove</button>

                </div>
            `;
            console.log(`[RENDER BOOKS] Appending book  with ISBN: ${book.isbn}`);

    
            libraryGrid.appendChild(bookDiv);
        });
    
        // Attach event listeners to comment buttons
        const commentButtons = document.querySelectorAll('.comment-button');
        commentButtons.forEach(button => {
        button.addEventListener('click', () => {
        showReviewPopup(button.getAttribute('data-isbn'), button.getAttribute('data-title'), !isOwnLibrary);
    });
});
saveReviewButton.addEventListener('click', async () => {
    const reviewText = document.getElementById('reviewText').value;
    const rating = ratingInput.value;
    const visibility = document.getElementById('visibility').value; // Get selected visibility
    const bookIsbn = modal.dataset.isbn;
    const username = localStorage.getItem('username');
    const reviewDate = new Date().toISOString(); // Get the current date and time in ISO format

    // Disable the save button to prevent multiple clicks
    saveReviewButton.disabled = true;
    
    // Close the modal immediately to improve user experience
    modal.style.display = 'none';
    
    try {
        const response = await fetch('/api/library/review', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, isbn: bookIsbn, review: reviewText, rating, reviewDate, visibility }), // Pass visibility
        });

        if (response.ok) {
            alert('Review saved successfully.');
            await fetchAndDisplayBooks('none', currentPage);  // Fetch the books for the current page
        } else {
            const error = await response.json();
            alert('Failed to save review: ' + error.message);
        }
    } catch (error) {
        console.error('Error saving review:', error);
        alert('Error saving review.');
    } finally {
        // Re-enable the save button after the request finishes
        saveReviewButton.disabled = false;
    }
});
       
    }
    

    
      
    if (username) {
        
        
        try {
            const response = await fetch(`/api/library/readList/${username}`);
            const data = await response.json();
            const readingListGrid = document.getElementById('readingListGrid');
            readingListGrid.className = 'library-container'; // Apply library-container class
            if (data.success && data.readList.length > 0) {
                data.readList.forEach(book => {
                    const bookDiv = document.createElement('div');
                    bookDiv.classList.add('library-card', 'relative', 'p-6', 'rounded-lg', 'shadow-lg', 'cursor-pointer', 'hover:shadow-2xl', 'transition', 'duration-300', 'ease-in-out');
                    bookDiv.innerHTML = `
                        <div class="relative group library-card" style="border: 4px solid ${getGradientColor(book.rating)};">
                            <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                                <img src="${book.thumbnail}" alt="${book.title}" class="w-full h-64 object-cover rounded-t-lg">
                                <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                                    <h2 class="text-lg font-bold">${book.title}</h2>
                                    <p class="text-gray-300">by ${book.authors}</p>
                                </div>
                            </a>
                            <button onclick="removeFromReadingList('${username}', '${book.isbn}')" class="absolute top-0 left-0 mt-2 ml-2 text-xs bg-red-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">Remove</button>
                        </div>
                    `;
                    readingListGrid.appendChild(bookDiv);
                });
                // Attach event listeners to comment buttons
                if (isOwnLibrary) {
                    const commentButtons = document.querySelectorAll('.comment-button');
                    commentButtons.forEach(button => {
                        button.addEventListener('click', () => {
                            showReviewPopup(button.getAttribute('data-isbn'), button.getAttribute('data-title'));
                        });
                    });
                } else {
                    const commentButtons = document.querySelectorAll('.comment-button');
                    commentButtons.forEach(button => {
                        button.addEventListener('click', () => {
                            showReviewPopup(button.getAttribute('data-isbn'), button.getAttribute('data-title'), !isOwnLibrary);
                        });
                    }); 
                }
            } else {
                addPlaceholderCards(readingListGrid, "Empty Book");
            }
        } catch (error) {
            console.error('Error fetching user reading list:', error);
            document.getElementById('readingListGrid').innerHTML = '<p>Error loading reading list.</p>';
        }
        

        
    } else {
        addPlaceholderCards(libraryGrid, "Empty Book");
        addPlaceholderCards(readingListGrid, "Empty Book");

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
        currentRating = event.target.value;
        const gradientColor = getGradientColor(currentRating);
        updateSliderBackground(ratingInput, currentRating);
    });
});

function addPlaceholderCards(container, message) {

        const placeholderDiv = document.createElement('div');
        placeholderDiv.classList.add('relative', 'p-6', 'rounded-lg', 'shadow-lg', 'bg-gray-800', 'flex', 'items-center', 'justify-center');
        placeholderDiv.style.width = '200px';  // Adjust the width as needed
        placeholderDiv.style.height = '300px';
        placeholderDiv.innerHTML = `
            <div class="relative group w-full h-64 flex items-center justify-center">
                <span class="text-white text-xl flex items-center justify-center w-full h-full">${message.replace(/\n/g, '<br>')}</span>
                <span style="position: absolute; right: -100px; top: 85%; transform: translateY(-50%); font-size: 8rem; color: white;">...</span>

            </div>
        `;
        container.appendChild(placeholderDiv);
        

}

// Function to show the review popup
async function showReviewPopup(bookIsbn, bookTitle, isReadOnly = false) {
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('username');
    const modal = document.getElementById('reviewModal');
    const loggedInUsername = localStorage.getItem('username'); // Get the logged-in username

    const username = profileUsername || loggedInUsername; // Use the profile username
    modal.dataset.isbn = bookIsbn; // Set the bookIsbn in the modal's dataset
    modal.querySelector('h2').innerHTML = `Review for <em>${bookTitle}</em>`;

    try {
        const response = await fetch(`/api/library/review/${username}/${bookIsbn}`);
        const data = await response.json();

        if (data.success) {
            document.getElementById('reviewText').value = data.review || '';
            document.getElementById('rating').value = data.rating || 50;
            document.getElementById('ratingValue').textContent = data.rating || 50;
            updateSliderBackground(document.getElementById('rating'), data.rating || null);

            // Handle visibility
            // Update visibility dropdown
                const visibilityDropdown = document.getElementById('visibility');
                if (data.visibility) {
                    visibilityDropdown.value = data.visibility;
                } else {
                    visibilityDropdown.value = 'public';  // Default to 'public' if not available
                }
            if (data.reviewDate) {
                const reviewDate = new Date(data.reviewDate);
                const formattedDate = reviewDate.toLocaleString();
                document.getElementById('reviewDate').textContent = `Reviewed on: ${formattedDate}`;
            } else {
                document.getElementById('reviewDate').textContent = ''; // Clear if no date
            }

            // Make fields read-only if viewing another user's review
            if (isReadOnly) {
                document.getElementById('reviewText').disabled = true;
                document.getElementById('rating').disabled = true;
                visibilityDropdown.disabled = true; // Disable visibility if read-only
                document.getElementById('saveReview').style.display = 'none'; // Hide the save button
            } else {
                document.getElementById('reviewText').disabled = false;
                document.getElementById('rating').disabled = false;
                visibilityDropdown.disabled = false; // Enable visibility select
                document.getElementById('saveReview').style.display = 'inline-block'; // Show the save button
            }
        } else {
            // Clear fields if no data
            document.getElementById('reviewText').value = '';
            document.getElementById('rating').value = 50;
            document.getElementById('ratingValue').textContent = 50;
            updateSliderBackground(document.getElementById('rating'), null);
            document.getElementById('reviewDate').textContent = ''; // Clear if no date
            document.getElementById('visibility').value = 'public'; // Default to public
        }
    } catch (error) {
        console.error('Error fetching book review:', error);
        document.getElementById('reviewText').value = '';
        document.getElementById('rating').value = 50;
        document.getElementById('ratingValue').textContent = 50;
        updateSliderBackground(document.getElementById('rating'), null);
        document.getElementById('reviewDate').textContent = ''; // Clear if no date
        document.getElementById('visibility').value = 'public'; // Default to public
    }

    modal.style.display = 'block';
}

/*
function getGradientColor(value) {
    const hue = (value / 100) * 120; // 0 is red, 120 is green
    return `hsl(${hue}, 60%, 80%)`;
}
//if i don't like the bright colors above, switch to the below
*/
function getGradientColor(value) {
    // Define the dark pastel colors for green and red with more aesthetic adjustment
    const darkPastelGreen = [32, 154, 32]; // RGB for dark pastel green
    const darkPastelYellow = [255, 193, 37];
    const darkPastelRed = [102, 0, 0]; // RGB for dark pastel red

    let r, g, b;
    /* add in case i want default border to be white if no rating
    if (value === undefined || value === null) {
        // Default to white if there is no rating
        return `rgb(255, 255, 255)`;
    }
    */
    if (value <= 50) {
        // Interpolate between red and yellow
        const factor = value / 50;
        r = darkPastelRed[0] + ((darkPastelYellow[0] - darkPastelRed[0]) * factor);
        g = darkPastelRed[1] + ((darkPastelYellow[1] - darkPastelRed[1]) * factor);
        b = darkPastelRed[2] + ((darkPastelYellow[2] - darkPastelRed[2]) * factor);
    } else {
        // Interpolate between yellow and green
        const factor = (value - 50) / 50;
        r = darkPastelYellow[0] + ((darkPastelGreen[0] - darkPastelYellow[0]) * factor);
        g = darkPastelYellow[1] + ((darkPastelGreen[1] - darkPastelYellow[1]) * factor);
        b = darkPastelYellow[2] + ((darkPastelGreen[2] - darkPastelYellow[2]) * factor);
    }

    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}


function updateSliderBackground(slider, value) {
    if (value === null) {
        slider.style.background = '#444444'; // Set to dark grey if the value is null (no rating)
    } else {
        const gradientColor = getGradientColor(value);
        slider.style.background = `linear-gradient(90deg, ${gradientColor} ${value}%, #ffffff ${value}%)`;
    }

    // Update the slider thumb color
    const style = document.createElement('style');
    style.innerHTML = `
        input[type=range] {
            border: 2px solid #000000; /* Black border around the slider */
        }
        input[type=range]::-webkit-slider-thumb {
            background: ${value === null ? '#444444' : getGradientColor(value)};
        }
        input[type=range]::-moz-range-thumb {
            background: ${value === null ? '#444444' : getGradientColor(value)};
        }
    `;
    document.head.appendChild(style);
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
async function removeFromReadingList(username, isbn) {
    try {
        const response = await fetch('/api/library/readList/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, isbn }),
        });

        if (response.ok) {
            alert('Book removed from your reading list.');
            window.location.href = '../html/library.html';
        } else {
            const error = await response.json();
            alert('Failed to remove book: ' + error.message);
        }
    } catch (error) {
        console.error('Error removing book from reading list:', error);
        alert('Error removing book from reading list.');
    }
}
