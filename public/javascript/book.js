document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const isbn = params.get('isbn');
    const bookDetails = document.getElementById('bookDetails');
    const username = localStorage.getItem('username');
    const userSection = document.getElementById('userSection');
    const scrollLeftButton = document.getElementById('scrollLeft');
    const scrollRightButton = document.getElementById('scrollRight');
    const recommendationsContainer = document.getElementById('recommendationsContainer');

    const createSparkles = () => {
        const sparkleContainer = document.getElementById('sparkleContainer');
        sparkleContainer.innerHTML = '';

        for (let i = 0; i < 9; i++) {
            const sparkle = document.createElement('div');
            const size = Math.random() * 10 + 8; // Random size between 10px and 20px
            const animationDuration = Math.random() * 1 + 0.5; // Random duration between 0.5s and 1.5s
    
            sparkle.className = 'sparkle';
            sparkle.style.width = `${size}px`;
            sparkle.style.height = `${size}px`;
            sparkle.style.top = `${Math.random() * 100}%`; // Random vertical position
            sparkle.style.left = `${Math.random() * 100}%`; // Random horizontal position
            sparkle.style.animationDuration = `${animationDuration}s`;
    
            sparkleContainer.appendChild(sparkle);
        }
    };
    
    // Function to show sparkles
    const showSparkles = () => {
        const sparkleContainer = document.getElementById('sparkleContainer');
        if (sparkleContainer) {
            sparkleContainer.style.display = 'flex';
            createSparkles();
        }
    };

    const hideSparkles = () => {
        const sparkleContainer = document.getElementById('sparkleContainer');
        if (sparkleContainer) {
            sparkleContainer.style.display = 'none';
            sparkleContainer.innerHTML = '';
        }
    };
    
    

    if (isbn) {
        try {
            showSparkles();
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
            const data = await response.json();
            if (data.totalItems > 0) {
                const book = data.items[0].volumeInfo;

                bookDetails.innerHTML = `
                    <div class="flex flex-col md:flex-row">
                        <div class="mr-8 mb-8 md:mb-0">
                            <img src="${book.imageLinks ? book.imageLinks.thumbnail : 'https://via.placeholder.com/128x192?text=No+Image'}" alt="${book.title}" class="w-64 h-96 object-cover mr-8 mb-8 md:mb-0">
                            <button id="addToLibraryButton" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded w-64">Add to Library</button>
                            <button id="addToTop5Button" class="mt-4 px-4 py-2 bg-green-900 text-white rounded w-64">Add to Top 5</button>
                            <button id="addToReadingListButton" class="mt-4 px-4 py-2 bg-blue-400 text-white rounded w-64">Add to Reading List</button>
                            <button onclick="loadBook('${isbn}')" class="mt-4 px-4 py-2 bg-green-500 text-white rounded w-64">Preview</button>

                        </div>
                        <div>
                            <h1 class="text-4xl font-bold mb-4">${book.title}</h1>
                            <h2 class="text-2xl mb-4">by ${book.authors ? book.authors.join(', ') : 'Unknown'}</h2>
                            <p class="text-xl mb-4"><strong>Categories:</strong> ${book.categories ? book.categories.join(', ') : 'None'}</p>
                            <p class="text-xl mb-4"><strong>Published:</strong> ${book.publishedDate}</p>
                            <p class="text-xl mb-4"><strong>Pages:</strong> ${book.pageCount}</p>
                            <p class="text-xl mb-4"><strong>Publisher:</strong> ${book.publisher}</p>
                            <p class="text-xl mb-4"><strong>Average Rating:</strong> ${book.averageRating ? book.averageRating : 'N/A'} (${book.ratingsCount ? book.ratingsCount : 0} ratings)</p>
                            <p class="text-xl mb-4">${book.description ? book.description : 'No description available'}</p>
                        </div>
                    </div>
                    <div id="recommendations" class="mt-8">
                        <div class="flex items-center mb-4">
                            <h2 class="text-3xl font-bold">Similar Books</h2>
                            <div id="sparkleContainer" class="ml-4 sparkle-container"></div>
                        </div>
                        <div class="recommendations-wrapper relative w-full mt-8">
                            <div id="recommendationsContainer" class="recommendations-container"></div>
                            <div class="arrow-hover-region left"></div>
                            <div class="arrow-hover-region right"></div>
                            <button class="arrow arrow-left" id="scrollLeft"><i class="fas fa-chevron-left"></i></button>
                            <button class="arrow arrow-right" id="scrollRight"><i class="fas fa-chevron-right"></i></button>
                        </div>
                    </div>
                `;


                document.getElementById('addToLibraryButton').addEventListener('click', () => addToLibrary(isbn));
                document.getElementById('addToTop5Button').addEventListener('click', () => addToTop5(isbn));
                document.getElementById('addToReadingListButton').addEventListener('click', () => addToReadingList(isbn));
                fetchRecommendations(isbn);
            } else {
                bookDetails.innerHTML = '<p>Book not found.</p>';
            }
        } catch (error) {
            hideSparkles();

        }
        finally{
            hideSparkles();        }
    } else {
        bookDetails.innerHTML = '<p>ISBN not provided.</p>';
    }
});

async function fetchRecommendations(isbn) {
    try {
        const response = await fetch(`/api/book-recommendations?isbn=${encodeURIComponent(isbn)}`);
        const data = await response.json();

        if (data.success) {
            const recommendationsContainer = document.getElementById('recommendationsContainer');
            recommendationsContainer.innerHTML = ''; // Clear previous recommendations if any
            data.recommendations.forEach(book => {
                const bookElement = document.createElement('div');
                bookElement.classList.add('bg-white', 'rounded', 'shadow-lg', 'p-4');
                bookElement.innerHTML = `
                    <img src="${book.thumbnail}" alt="${book.title}" class="w-full h-64 object-cover mb-4">
                    <h3 class="text-2xl font-bold mb-2">${book.title}</h3>
                    <p class="text-xl mb-2">by ${book.authors.join(', ')}</p>
                    <p class="text-md mb-4"><strong>Categories:</strong> ${book.categories.join(', ')}</p>
                    <p class="text-md mb-4">${book.description ? book.description.substring(0, 100) + '...' : 'No description available'}</p>
                `;
                recommendationsContainer.appendChild(bookElement);
            });
        } else {
            console.error('Error fetching recommendations:', data.message);
        }
    } catch (error) {
        console.error('Error fetching recommendations:', error);
    }
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
    const username = localStorage.getItem('username');
    if (!username) {
        alert('You need to be logged in to add books to your top 5.');
        return;
    }

    fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
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
    const username = localStorage.getItem('username');
    if (!username) {
        alert('You need to be logged in to add books to your top 5.');
        return;
    }

    fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
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
    const username = localStorage.getItem('username');
    if (!username) {
        alert('You need to be logged in to add books to your library.');
        return;
    }

    fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`)
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



const showArrow = (arrowButton) => {
    arrowButton.classList.add('visible');
};

const hideArrow = (arrowButton) => {
    arrowButton.classList.remove('visible');
};

scrollLeftButton.addEventListener('mouseenter', () => showArrow(scrollLeftButton));
scrollLeftButton.addEventListener('mouseleave', () => hideArrow(scrollLeftButton));

scrollRightButton.addEventListener('mouseenter', () => showArrow(scrollRightButton));
scrollRightButton.addEventListener('mouseleave', () => hideArrow(scrollRightButton));

document.querySelector('.arrow-hover-region.left').addEventListener('mouseenter', () => showArrow(scrollLeftButton));
document.querySelector('.arrow-hover-region.left').addEventListener('mouseleave', () => hideArrow(scrollLeftButton));

document.querySelector('.arrow-hover-region.right').addEventListener('mouseenter', () => showArrow(scrollRightButton));
document.querySelector('.arrow-hover-region.right').addEventListener('mouseleave', () => hideArrow(scrollRightButton));

scrollLeftButton.addEventListener('click', () => {
    recommendationsContainer.scrollBy({
        top: 0,
        left: -recommendationsContainer.clientWidth,
        behavior: 'smooth'
    });
});

scrollRightButton.addEventListener('click', () => {
    recommendationsContainer.scrollBy({
        top: 0,
        left: recommendationsContainer.clientWidth,
        behavior: 'smooth'
    });
});

const renderRecommendations = (recommendations) => {
    recommendationsContainer.innerHTML = '';
    recommendations.forEach(recommendation => {
        const recommendationElement = document.createElement('div');
        recommendationElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow');
        recommendationElement.innerHTML = `
            <div class="relative group">
                <a href="../html/book.html?isbn=${recommendation.isbn[0]}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                    <img src="${recommendation.thumbnail}" alt="${recommendation.title}" class="w-full h-72 object-cover">
                    <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                        <h2 class="text-lg font-bold">${recommendation.title}</h2>
                        <p class="text-gray-300">by ${recommendation.authors}</p>
                    </div>
                </a>
            </div>
        `;
        recommendationsContainer.appendChild(recommendationElement);
    });    
};
