document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const isbn = params.get('isbn');
    const bookDetails = document.getElementById('bookDetails');
    const username = localStorage.getItem('username');
    const userSection = document.getElementById('userSection');
    const recommendationsContainer = document.getElementById('recommendationsContainer');
    const apiKey = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'
    const reviewsSection = document.getElementById('reviewsSection');
    const reviewsContainer = document.getElementById('reviewsContainer');
    const loggedInUsername = localStorage.getItem('username'); // Add this line at the top
   

    if (isbn) {
        try {
            console.log(`Fetching data for ISBN: ${isbn}`);  // Logging ISBN
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${apiKey}`);
            const data = await response.json();
            console.log(`API response: `, data);  // Logging API response
            if (data.totalItems > 0) {
                const book = data.items[0].volumeInfo;
                document.body.style.backgroundColor = '#2d342d'; // Dark green as fallbac
                

                bookDetails.innerHTML = `
                <div class="content-container flex">
    <!-- Left section (fixed) -->
    <div class="w-1/4 fixed top-40 left-20 h-screen">
        <div class="relative"> 
            <img src="${book.imageLinks ? book.imageLinks.thumbnail.replace('zoom=1', '') + '&zoom=1' : 'https://via.placeholder.com/128x192?text=No+Image'}" alt="${book.title}" class="book-card card book-cover w-60 h-96 object-cover mb-8">
        </div>

        <!-- Button section: Preview and Add Buttons side by side -->
        <div class="flex items-center gap-4 mt-4">
            <!-- Preview Button -->
            <button id="previewButton" onclick="loadBook('${isbn}')" class="px-4 py-2 bg-green-500 text-white rounded h-48px w-40">Preview</button>
            
            <!-- Add Button Next to Preview Button -->
            <div class="add-button-container">
                <button id="addButton" class="add-button relative flex items-center justify-center">
                    <div class="icon-container absolute left-2.8 flex flex-col space-y-1">
                        <div class="line w-5 h-0.5 bg-white"></div>
                        <div class="line w-5 h-0.5 bg-white"></div>
                        <div class="line w-5 h-0.5 bg-white"></div>
                    </div>
                    <div class="plus-icon absolute top-0 right-0 w-2 h-2 rounded-full bg-white text-green-600 text-xs flex items-center justify-center">
                        +
                    </div>
                </button>

                <!-- Dropdown Menu Overlay -->
                <div id="dropdownMenu" class="hidden fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50">
                    <div class="bg-white rounded-lg shadow-xl w-80 transform transition-all duration-300 scale-95 opacity-0">
                        <div class="py-2">
                            <div class="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                                <h3 class="text-lg font-semibold text-gray-700">Add to...</h3>
                                <button id="closeDropdown" class="text-gray-400 hover:text-gray-500 transition-colors duration-200">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                                    </svg>
                                </button>
                            </div>
                            <ul class="menu-list py-2">
                                <li>
                                    <button id="addToLibraryButton" class="w-full text-left px-4 py-3 text-gray-700 hover:bg-green-50 flex items-center gap-3 transition-colors duration-200">
                                        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                                        </svg>
                                        <span>Library</span>
                                    </button>
                                </li>
                                <li>
                                    <button id="addToReadingListButton" class="w-full text-left px-4 py-3 text-gray-700 hover:bg-green-50 flex items-center gap-3 transition-colors duration-200">
                                        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path>
                                        </svg>
                                        <span>Reading List</span>
                                    </button>
                                </li>
                                <li>
                                    <button id="addToTop5Button" class="w-full text-left px-4 py-3 text-gray-700 hover:bg-green-50 flex items-center gap-3 transition-colors duration-200">
                                        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"></path>
                                        </svg>
                                        <span>Top 5</span>
                                    </button>
                                </li>
                                <li>
                                    <button id="addToCurrentlyReadingButton" class="w-full text-left px-4 py-3 text-gray-700 hover:bg-green-50 flex items-center gap-3 transition-colors duration-200">
                                        <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                                        </svg>
                                        <span>Currently Reading</span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- Center Content (flexible width) -->
    <div class="flex-1 ml-52 mr-0 mt-8">
        <div class="pr-8">
            <h1 class="text-4xl font-bold mb-3 text-white">${book.title}</h1>
            <h2 class="text-xl mb-3 text-white">by ${book.authors ? book.authors.join(', ') : 'Unknown'}</h2>
            <p class="text-base mb-2 text-white"><strong>Categories:</strong> ${book.categories ? book.categories.join(', ') : 'None'}</p>
            <p class="text-base mb-2 text-white"><strong>Published:</strong> ${book.publishedDate}</p>
            <p class="text-base mb-2 text-white"><strong>Pages:</strong> ${book.pageCount}</p>
            <p class="text-base mb-2 text-white"><strong>Average Rating:</strong> ${book.averageRating ? book.averageRating : 'N/A'} (${book.ratingsCount ? book.ratingsCount : 0} ratings)</p>
            <p class="text-base mb-2 text-white">${book.description ? book.description : 'No description available'}</p>

            <!-- Reviews Section -->
            <div id="reviewsSection" class="mt-2">
                <h2 class="text-3xl font-bold mb-4 text-white font-medium tan-title"><em>Reviews</em></h2>
                <div id="reviewsContainer" class= "mt-2"></div>
            </div>
        </div>
    </div>
   <!-- Recommendations Section -->
    <div id="recommendations" class="mt-8 right-5 w-1/6">
        <h2 class="text-3xl font-bold mb-4 text-white font-medium tan-title"><em>Similar Books </em></h2>
        <div class="single-recommendations-wrapper relative w-full mt-8 overflow-auto">
            <div id="loadingVisual" class="loading-balls-container">
                <div class="ball"></div>
                <div class="ball"></div>
                <div class="ball"></div>
            </div>
            <div id="recommendationsContainer" class="single-recommendations-container"></div>
        </div>
    </div>
</div>
            `;
            const addButton = document.getElementById('addButton');
            const addToReadingListButton = document.getElementById('addToReadingListButton');
            const addToLibraryButton = document.getElementById('addToLibraryButton');
            const addToTop5Button = document.getElementById('addToTop5Button');
            const dropdownMenu = document.getElementById('dropdownMenu');
           
        
            addButton.addEventListener('click', () => {
                const dropdownMenu = document.getElementById('dropdownMenu');
                dropdownMenu.classList.remove('hidden');
                // Add animation classes after a brief delay
                setTimeout(() => {
                    const menuContent = dropdownMenu.querySelector('.bg-white');
                    menuContent.classList.remove('scale-95', 'opacity-0');
                    menuContent.classList.add('scale-100', 'opacity-100');
                }, 10);
            });
            const addToCurrentlyReadingButton = document.getElementById('addToCurrentlyReadingButton');

            addToCurrentlyReadingButton.addEventListener('click', () => {
                addToCurrentlyReading(isbn); // Use the `isbn` variable already loaded in this context
                dropdownMenu.classList.add('hidden'); // Hide the dropdown menu after the action
            });


            function addToCurrentlyReading(isbn) {
                const apiKey = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8';
                const username = localStorage.getItem('username');
            
                if (!username) {
                    alert('You need to be logged in to add books to Currently Reading.');
                    return;
                }
            
                // Fetch book details using the Google Books API
                fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${apiKey}`)
                    .then(response => response.json())
                    .then(data => {
                        const book = data.items[0].volumeInfo;
                        const bookData = {
                            username,
                            isbn,
                            title: book.title,
                            authors: book.authors ? book.authors.join(', ') : 'Unknown',
                            categories: book.categories ? book.categories : [],
                            pageCount: book.pageCount,
                            description: book.description ? book.description : 'No description available',
                            thumbnail: book.imageLinks ? book.imageLinks.thumbnail : 'https://via.placeholder.com/128x192?text=No+Image'
                        };
            
                        // Send book data to the backend API
                        fetch('/api/library/currently-reading/add', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(bookData),
                        })
                        .then(response => response.json())
                        .then(data => {
                            alert("Book successfully added to Currently Reading!")
                        })
                        .catch(error => {
                            console.error('Error adding book to Currently Reading:', error);
                            alert('Error adding book to Currently Reading.');
                        });
                    })
                    .catch(error => {
                        console.error('Error fetching book data:', error);
                        alert('Error fetching book data.');
                    });
            }
            
        
            // Add functionality for each option
            addToLibraryButton.addEventListener('click', () => {
                addToLibrary(isbn);
                dropdownMenu.classList.add('hidden'); // Hide menu after action
            });
        
            addToReadingListButton.addEventListener('click', () => {
                addToReadingList(isbn);
                dropdownMenu.classList.add('hidden'); // Hide menu after action
            });
        
            addToTop5Button.addEventListener('click', () => {
                addToTop5(isbn);
                dropdownMenu.classList.add('hidden'); // Hide menu after action
            });
            window.addEventListener('click', (event) => {
                const dropdownMenu = document.getElementById('dropdownMenu');
                if (event.target === dropdownMenu) {
                    const menuContent = dropdownMenu.querySelector('.bg-white');
                    menuContent.classList.add('scale-95', 'opacity-0');
                    setTimeout(() => {
                        dropdownMenu.classList.add('hidden');
                    }, 200);
                }
            });
            dropdownMenu.addEventListener('click', (event) => {
                event.stopPropagation();
            });
    
            
                fetchAndDisplayReviews(isbn);

                fetchRecommendations(isbn);

            } else {
                bookDetails.innerHTML = '<p style="color: white;">Book not found.</p>';
            }
        } catch (error) {
            console.error('Error fetching book data:', error);
            bookDetails.innerHTML = '<p>Error fetching book data.</p>';
        }
        } else {
        bookDetails.innerHTML = '<p>ISBN not provided.</p>';
    }

    // After the bookDetails.innerHTML section, add this event listener setup:
    document.querySelector('#closeDropdown').addEventListener('click', () => {
        const dropdownMenu = document.getElementById('dropdownMenu');
        dropdownMenu.classList.add('hidden');
    });
});
async function displayNoReviewMessage() {
    const reviewContainer = document.getElementById('reviewsContainer'); // Assuming there's a container for reviews

    // Clear any existing content in the review container
    reviewContainer.innerHTML = '';

    // Create a message element
    const noReviewsMessage = document.createElement('div');
    noReviewsMessage.classList.add('no-reviews-message', 'text-left', 'text-gray-500', 'p-4');
    noReviewsMessage.innerHTML = `
        <p>Be the first to review this book!</p>
    `;

    // Append the message to the review container
    reviewContainer.appendChild(noReviewsMessage);
}
async function fetchRecommendations(isbn) {
    try {
        document.getElementById('loadingVisual').classList.remove('hidden');

        const response = await fetch(`/api/book-recommendations?isbn=${encodeURIComponent(isbn)}`);
        const data = await response.json();

        if (data.success) {
            renderRecommendations(data.recommendations);
        } else {
            console.error('Error fetching recommendations:', data.message);
        }
    } catch (error) {
        console.error('Error fetching recommendations:', error);
    }finally {
        // Hide the loading visual once the recommendations are loaded
        const loadingVisual = document.getElementById('loadingVisual');
        if (loadingVisual) {
            loadingVisual.classList.add('hidden');
        }    }
}

// Modal handling
function loadBook(isbn) {
    if (isbn) {
        initialize(isbn);
        document.getElementById('myModal').classList.remove('hidden');
        document.getElementById('myModal').classList.add('flex');
    } else {
        alert('ISBN not found.');
    }
}

function closeModal() {
    document.getElementById('myModal').classList.add('hidden');
    document.getElementById('myModal').classList.remove('flex');
}

window.onclick = function(event) {
    const modal = document.getElementById('myModal');
    if (event.target == modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}
// Initialize Google Books API
google.books.load();
 
function alertNotFound() {
   alert("Could not embed the book!");
}

function initialize(isbn) {
   var viewerCanvas = document.getElementById('viewerCanvas');
   if (viewerCanvas) {
       var viewer = new google.books.DefaultViewer(viewerCanvas);
       viewer.load('ISBN:' + isbn, alertNotFound);
   }
}

function addToTop5(isbn) {
    const apiKey = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'

    const username = localStorage.getItem('username');
    if (!username) {
        alert('You need to be logged in to add books to your top 5.');
        return;
    }

    fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${apiKey}`)
        .then(response => response.json())
        .then(data => {
            const book = data.items[0].volumeInfo;
            const bookData = {
                username,
                isbn,
                title: book.title,
                authors: book.authors ? book.authors.join(', ') : 'Unknown',
                categories: book.categories ? book.categories : [],
                pageCount: book.pageCount,
                description: book.description ? book.description : 'No description available',
                thumbnail: book.imageLinks ? book.imageLinks.thumbnail : 'https://via.placeholder.com/128x192?text=No+Image'
            };

            fetch('/api/library/top5/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookData),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Book added to your top 5!');
                } else {
                    alert('Failed to add book to top 5: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error adding book to top 5:', error);
                alert('Error adding book to top 5.');
            });
        })
        .catch(error => {
            console.error('Error fetching book data:', error);
            alert('Error fetching book data.');
        });
}


function addToReadingList(isbn) {
    const apiKey = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'
    const username = localStorage.getItem('username');
    if (!username) {
        alert('You need to be logged in to add books to your top 5.');
        return;
    }

    fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${apiKey}`)
        .then(response => response.json())
        .then(data => {
            const book = data.items[0].volumeInfo;
            const bookData = {
                username,
                isbn,
                title: book.title,
                authors: book.authors ? book.authors.join(', ') : 'Unknown',
                categories: book.categories ? book.categories : [],
                pageCount: book.pageCount,
                description: book.description ? book.description : 'No description available',
                thumbnail: book.imageLinks ? book.imageLinks.thumbnail : 'https://via.placeholder.com/128x192?text=No+Image'
            };

            fetch('/api/library/readList/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookData),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    alert('Book added to your reading list');
                } else {
                    alert('Failed to add book to reading list: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error adding book to reading list:', error);
                alert('Error adding book to reading list.');
            });
        })
        .catch(error => {
            console.error('Error fetching book data:', error);
            alert('Error fetching book data.');
        });
}

function addToLibrary(isbn) {
    const apiKey = 'AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8'
    const username = localStorage.getItem('username');
    if (!username) {
        alert('You need to be logged in to add books to your library.');
        return;
    }

    fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${apiKey}`)
        .then(response => response.json())
        .then(data => {
            const book = data.items[0].volumeInfo;
            const bookData = {
                username,
                isbn,
                title: book.title,
                authors: book.authors ? book.authors.join(', ') : 'Unknown',
                categories: book.categories ? book.categories : [],
                pageCount: book.pageCount,
                description: book.description ? book.description : 'No description available',
                thumbnail: book.imageLinks ? book.imageLinks.thumbnail : 'https://via.placeholder.com/128x192?text=No+Image'
            };

            fetch('/api/library/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(bookData),
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Book added successfully, showing review popup...');
                    showReviewPopup(isbn, book.title);
                    alert('Book added to your library!');
                } else {
                    alert('Failed to add book to library: ' + data.message);
                }
            })
            .catch(error => {
                console.error('Error adding book to library:', error);
                alert('Error adding book to library.');
            });
        })
        .catch(error => {
            console.error('Error fetching book data:', error);
            alert('Error fetching book data.');
        });
}

// Add these new functions for the review popup
function showReviewPopup(bookIsbn, bookTitle) {
    console.log('showReviewPopup called with:', { bookIsbn, bookTitle });
    const modal = document.getElementById('bookReviewModal');
    console.log('Modal element:', modal);
    
    if (!modal) {
        console.error('Review modal element not found!');
        return;
    }

    const closeModal = document.getElementById('closeBookReviewModal');
    const ratingInput = document.getElementById('bookRating');
    const ratingValue = document.getElementById('bookRatingValue');
    const saveReviewButton = document.getElementById('saveBookReview');
    const reviewLaterButton = document.getElementById('reviewBookLater');
    const reviewText = document.getElementById('bookReviewText');
    const visibility = document.getElementById('bookVisibility');
    const reviewDate = document.getElementById('bookReviewDate');
    const username = localStorage.getItem('username');

    // Fetch existing review if any
    fetch(`/api/library/review/${username}/${bookIsbn}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                reviewText.value = data.review || '';
                ratingInput.value = data.rating || 50;
                ratingValue.textContent = data.rating || 50;
                updateSliderBackground(ratingInput, data.rating || null);

                // Handle visibility
                if (data.visibility) {
                    visibility.value = data.visibility;
                } else {
                    visibility.value = 'public';  // Default to 'public' if not available
                }

                if (data.reviewDate) {
                    const reviewDateObj = new Date(data.reviewDate);
                    const formattedDate = reviewDateObj.toLocaleString();
                    reviewDate.textContent = `Reviewed on: ${formattedDate}`;
                } else {
                    reviewDate.textContent = ''; // Clear if no date
                }
            }
        })
        .catch(error => {
            console.error('Error fetching existing review:', error);
        });

    // Show the modal
    console.log('Showing modal...');
    modal.classList.remove('hidden');
    console.log('Modal classes after showing:', modal.classList);

    // Update rating value display and slider background
    ratingInput.addEventListener('input', () => {
        const value = ratingInput.value;
        ratingValue.textContent = value;
        updateSliderBackground(ratingInput, value);
    });

    // Initial slider background update
    updateSliderBackground(ratingInput, ratingInput.value);

    // Close modal handlers
    closeModal.onclick = () => {
        modal.classList.add('hidden');
    };

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    };

    // Save review handler
    saveReviewButton.onclick = async () => {
        const reviewData = {
            username,
            isbn: bookIsbn,
            review: reviewText.value,
            rating: parseInt(ratingInput.value),
            visibility: visibility.value,
            reviewDate: new Date().toISOString()
        };

        // Disable the save button to prevent multiple clicks
        saveReviewButton.disabled = true;

        try {
            const response = await fetch('/api/library/review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(reviewData)
            });

            const data = await response.json();
            if (data.success) {
                alert('Review saved successfully!');
                modal.classList.add('hidden');
                // Refresh reviews section
                fetchAndDisplayReviews(bookIsbn);
            } else {
                alert('Failed to save review: ' + data.message);
            }
        } catch (error) {
            console.error('Error saving review:', error);
            alert('Error saving review. Please try again.');
        } finally {
            // Re-enable the save button after the request finishes
            saveReviewButton.disabled = false;
        }
    };

    // Review later handler
    reviewLaterButton.onclick = () => {
        modal.classList.add('hidden');
    };
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

async function fetchAndDisplayReviews(isbn) {
    const loggedInUsername = localStorage.getItem('username'); // Add this line at the top
    try {
        const response = await fetch(`/api/reviews/books/${isbn}?loggedInUsername=${loggedInUsername}`);
        const data = await response.json();

        if (data.success && data.reviews.length > 0) {
            console.log('Reviews found:', data.reviews);
            displayReview(data.reviews);  // Display reviews in the UI
        } else {
            console.log('No reviews available or error:', data.message);
            displayNoReviewMessage(data.message);  // Show a message when no reviews are found
        }
    } catch (error) {
        console.error('Error fetching reviews:', error);
    }
}

async function displayReview(reviews) {
    console.log(reviews);

    reviewsContainer.innerHTML = ''; // Clear previous reviews if any

    // Separate friends-only reviews from public reviews
    const friendReviews = reviews.filter(review => review.visibility === 'friends');
    const publicReviews = reviews.filter(review => review.visibility === 'public');

    // Display friend reviews first, if any
    if (friendReviews.length > 0) {
        const friendsHeader = document.createElement('h4');
        friendsHeader.classList.add('text-lg', 'font-bold', 'mb-2');
        friendsHeader.textContent = 'Reviews from Friends';
        reviewsContainer.appendChild(friendsHeader);

        friendReviews.forEach(review => {
            const reviewElement = createReviewElement(review, true);
            reviewsContainer.appendChild(reviewElement);
        });
    }

    // Display public reviews
    if (publicReviews.length > 0) {
        const publicHeader = document.createElement('h4');
        publicHeader.classList.add('text-lg', 'font-bold', 'mt-4', 'mb-2', 'text-white');
        publicHeader.textContent = 'Public Reviews';
        reviewsContainer.appendChild(publicHeader);

        publicReviews.forEach(review => {
            console.log('Rendering Public Review:', review);  // Log each public review
            const reviewElement = createReviewElement(review, false);
            reviewsContainer.appendChild(reviewElement);
        });
    } else {
        reviewsContainer.innerHTML += '<p>No public reviews available.</p>';
    }
}
function createReviewElement(review, isFriend) {
    const params = new URLSearchParams(window.location.search);
    const isbn = params.get('isbn');

    const reviewDiv = document.createElement('div');
    reviewDiv.classList.add('review', 'p-4', 'mb-4', 'border', 'rounded', 'bg-white', 'shadow-md');
    const gradientColor = getGradientColor(review.rating);
    reviewDiv.style.boxShadow = `0 0 10px 3px ${gradientColor}`; // Glowing effect

    // Apply the gradient color to the review's border
    reviewDiv.style.border = `2px solid ${gradientColor}`;
    // Add a background color and padding
    reviewDiv.style.backgroundColor = '#ffffff'; // White background
    reviewDiv.style.padding = '16px';
    reviewDiv.style.borderRadius = '8px';

    // Badge for public or friends visibility
    const visibilityBadge = isFriend 
        ? `<span class="ml-2 inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-green-600 text-white">
                ✓ Friends
           </span>`
        : `<span class="ml-2 inline-flex items-center px-3 py-0.5 rounded-full text-sm font-medium bg-blue-600 text-white">
                🌍 Public
           </span>`;
           
    const isLikedClass = review.isLikedByUser ? 'text-red-500' : 'text-gray-600';

    reviewDiv.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <a href="../html/profile.html?username=${review.username}" class="text-lg font-semibold" style="display: inline-flex; text-decoration: none; color: #333; padding: 2px 4px;"
                onmouseover="this.style.textDecoration='underline'; this.style.color='#555';"
                onmouseout="this.style.textDecoration='none'; this.style.color='#333';">
                    ${review.username}
                </a>  
                ${visibilityBadge}
            </div>
            <button class="like-button flex items-center ${isLikedClass} hover:text-red-500 focus:outline-none" 
                    data-review-id="${review._id}"
                    data-is-liked="${review.isLikedByUser}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <span class="like-count">${review.likes || 0}</span>
            </button>
        </div>
   
        <p class="text-sm text-gray-600 mb-2">Rating: <strong>${review.rating}/100</strong></p>
        <p class="text-gray-600 mb-2 ml-2">${review.review}</p>
        <p class="text-xs text-gray-500">Reviewed on: ${new Date(review.reviewDate).toLocaleDateString()}</p>
    `;

    // Attach like button event listener
    const likeButton = reviewDiv.querySelector('.like-button');
    likeButton.addEventListener('click', async () => {
        const reviewId = likeButton.getAttribute('data-review-id'); 
        await toggleLikeReview(reviewId, likeButton);
    });

    return reviewDiv;
}
async function toggleLikeReview(reviewId, likeButton) {
    try {
        const username = localStorage.getItem('username');
        const isLiked = likeButton.getAttribute('data-is-liked') === 'true';
        const isbn = new URLSearchParams(window.location.search).get('isbn');

        const endpoint = isLiked 
            ? `/api/reviews/${isbn}/unlike` 
            : `/api/reviews/${isbn}/like`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                const likeCountElement = likeButton.querySelector('.like-count');
                likeCountElement.textContent = data.likes.length || 0;
                likeButton.classList.toggle('text-red-500');
                likeButton.classList.toggle('text-gray-600');
                // Update the data-is-liked attribute
                likeButton.setAttribute('data-is-liked', (!isLiked).toString());
            } else {
                console.error('Failed to toggle like:', data.message);
            }
        } else {
            console.error('Failed to toggle like:', response.statusText);
        }
    } catch (error) {
        console.error('Error toggling like:', error);
    }
}


function renderRecommendations(recommendations) {
    const recommendationsContainer = document.getElementById('recommendationsContainer');
    recommendationsContainer.innerHTML = ''; // Clear previous recommendations if any

    recommendations.slice(0, 5).forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.classList.add('library-card', 'relative', 'p-6', 'rounded-lg', 'shadow-lg', 'cursor-pointer', 'hover:shadow-2xl', 'transition', 'duration-300', 'ease-in-out');
        bookElement.innerHTML = `
            <div class="relative group book-card library-card">
                <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out group">
                    <img src="${book.thumbnail}" alt="${book.title}" class="w-full h-64 object-cover rounded-t-lg">
                    <div class="absolute bottom-0 left-0 w-full p-2 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
                        <h2 class="text-sm font-bold">${book.title}</h2>
                        <p class="text-gray-300 text-xs">by ${book.authors}</p>
                    </div>
                </a>
            </div>
        `;
        recommendationsContainer.appendChild(bookElement);
    });
}
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
