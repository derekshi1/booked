document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generateRecommendationsButton');
    const scrollLeftButton = document.getElementById('scrollLeft');
    const scrollRightButton = document.getElementById('scrollRight');
    const scrollLeftButton_nyt = document.getElementById('scrollLeft_nyt');
    const scrollRightButton_nyt = document.getElementById('scrollRight_nyt');
    const scrollLeftNF = document.getElementById('scrollLeftNF');
    const scrollRightNF = document.getElementById('scrollRightNF');
    const scrollLeftYA = document.getElementById('scrollLeftYA');
    const scrollRightYA = document.getElementById('scrollRightYA');
    const username = localStorage.getItem('username'); // Ensure the username is stored in localStorage

    const recommendationsContainer = document.getElementById('recommendationsContainer');
    const loadingSpinner = document.getElementById('loadingSpinner'); // Ensure this element exists
    const sparkleContainer = document.getElementById('sparkleContainer');
    const bestSellersContainer = document.getElementById('bestSellersContainer');

    const oppRecommendationsContainer = document.getElementById('oppRecommendationsContainer');
    const scrollLeft_OppRec = document.getElementById('scrollLeft_OppRec');
    const scrollRight_OppRec = document.getElementById('scrollRight_OppRec');

    const lastFetchTimeKey = `${username}_lastFetchTime`;
    const nextFetchTimeKey = `${username}_nextFetchTime`;
    const recommendationsKey = `${username}_recommendations`;
    const oppRecommendationsKey = `${username}_opposite_recommendations`; 

    const lastFetchTime = localStorage.getItem(lastFetchTimeKey);
    const storedRecommendations = JSON.parse(localStorage.getItem(recommendationsKey));
    const now = new Date().getTime();
    const hoursBetweenFetches = 4; // Number of hours before fetching new recommendations
    const timeThreshold = hoursBetweenFetches * 60 * 60 * 1000; // Convert hours to milliseconds

    const clickLimit = 3; // Number of allowed clicks
    const limitResetTime = 3 * 60 * 60 * 1000; // Reset time in milliseconds (3 hours)
    const clickDataKey = `${username}_clickData`;
    const clickData = getClickData();
    const countdownElement = document.getElementById('countdownTimer_rec'); // Moved here to ensure it's available in all functions
    const urlParams = new URLSearchParams(window.location.search);
    const bypassLimit = urlParams.get('bypassLimit') === 'True';
    


    // Ensure initial state is set to "For Me" when checked
  

    // Add event listener to toggle text when the checkbox is toggled
   

    function toggleFriendSelection(username, element) {
        const index = selectedUsernames.indexOf(username);
        const usernameText = element.querySelector('span'); // Find the username text element
    
        if (index === -1) {
            // If the username is not already selected, add it and change the text color
            selectedUsernames.push(username);
            usernameText.classList.add('text-green-700'); // Change text color to green
        } else {
            // If the username is already selected, remove it and reset the text color
            selectedUsernames.splice(index, 1);
            usernameText.classList.remove('text-green-700'); // Reset text color
        }
    }
    
    searchFriendsInput.addEventListener('input', async function() {
        const query = this.value;
        if (query.length < 2) return; // Wait until the user has typed at least 2 characters
    
        try {
            const response = await fetch(`/api/search-users?query=${encodeURIComponent(query)}`);
            const data = await response.json();
    
            if (data.success) {
                // Clear previous results
                searchResults.innerHTML = '';
                data.users.forEach(user => {
                    const userContainer = document.createElement('div');
                    userContainer.classList.add('flex', 'items-center', 'p-2', 'border-b', 'cursor-pointer');
                
                    const profileImage = document.createElement('img');
                    profileImage.src = user.profilePicture || '../profile.png'; // Use default if no profile picture
                    profileImage.classList.add('w-10', 'h-10', 'rounded-full', 'mr-3'); // Styling for the image
                
                    // Create the text element for the username
                    const usernameText = document.createElement('span');
                    usernameText.textContent = user.username;
                    usernameText.classList.add('text-gray-200', 'font-semibold', 'hover:text-gray-600'); // Move hover class here
                
                    // Append the image and username to the user container
                    userContainer.appendChild(profileImage);
                    userContainer.appendChild(usernameText);
                
                    // Append the user container to the search results
                    searchResults.appendChild(userContainer);
                
                    // Add click event listener for selection
                    userContainer.addEventListener('click', () => toggleFriendSelection(user.username, userContainer));
                });
                
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    });


    const startGenerateCountdown = (timeLeft) => {
        const countdownElement = document.getElementById('countdownTimer_rec'); // Use the new ID for countdown timer
    
        const updateCountdown = () => {
            const currentTime = new Date().getTime();
            const timeRemaining = timeLeft - (currentTime - clickData.lastReset);
    
            if (timeRemaining <= 0) {
                generateButton.disabled = false;
                clearInterval(generateCountdownInterval);
                return;
            }
    
            const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
            const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
    
            countdownElement.textContent = `Next recommendations in ${hours}h ${minutes}m ${seconds}s`;
            countdownElement.style.fontStyle = 'italic';
        };
    
        const generateCountdownInterval = setInterval(updateCountdown, 1000); // Declare generateCountdownInterval after updateCountdown
        updateCountdown(); // Initial call to display the countdown immediately
    };
    function getClickData() {
        const clickData = JSON.parse(localStorage.getItem(clickDataKey));
        return clickData ? clickData : { count: 0, lastReset: Date.now() };
    }
    
    function updateClickData(data) {
        localStorage.setItem(clickDataKey, JSON.stringify(data));
    }
    const updateRecommendationStatus = (clickData) => {
        const remainingRecs = clickLimit - clickData.count;
        if (remainingRecs > 0) {
            generateButton.classList.remove('glow-effect'); // Remove the glow effect if it's still active
            generateButton.disabled = false; // Disable the button if the limit has been reached
            countdownElement.textContent = `${remainingRecs} recommendation generations left`;
        } else {
            const timeUntilReset = limitResetTime - (now - clickData.lastReset);
            startGenerateCountdown(timeUntilReset);
            generateButton.disabled = true; // Disable the button if the limit has been reached
            generateButton.classList.remove('glow-button');
            generateButton.classList.add('glow-effect'); // Add the steady glow effect

        }
    };
    // Check if the reset time has passed
    if (now - clickData.lastReset >= limitResetTime) {
        clickData.count = 0; // Reset the count
        clickData.lastReset = now; // Reset the timestamp
        updateClickData(clickData); // Make sure to save this reset
    }
    
    if(!bypassLimit){
        updateRecommendationStatus(clickData);
    }

    
    // Function to create sparkles
    const createSparkles = () => {
        sparkleContainer.innerHTML = '';
            const sparkle = document.createElement('div');
            const size = Math.random() * 10 + 15; // Random size between 10px and 20px

            sparkle.className = 'sparkle';
            sparkle.style.width = `${size}px`;
            sparkle.style.height = `${size}px`;
            sparkle.style.top = '30%'; // Random vertical position
            sparkle.style.left = `20%`; // Random horizontal position
            sparkle.style.transform = 'translate(-50%, -50%)';
            sparkle.style.animationDuration = `1s`;

            sparkleContainer.appendChild(sparkle);
    };

    // Function to show sparkles
    const showSparkles = () => {
        sparkleContainer.style.display = 'flex';
        createSparkles();
    };

    // Function to hide sparkles
    const hideSparkles = () => {
        sparkleContainer.style.display = 'none';
        sparkleContainer.innerHTML = '';
    };

    // Function to render recommendations
    const renderRecommendations = (recommendations) => {
        recommendationsContainer.innerHTML = '';
        if (!recommendations || recommendations.length === 0) {
            console.warn('[DEBUG] No valid recommendations found. Rendering placeholders...');
            renderPlaceholderRecommendations();
            return;
        }
        recommendations.forEach(recommendation => {
            const recommendationElement = document.createElement('div');
            recommendationElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow-lg');
    
            // Function to generate a random color
            const generateRandomColor = () => {
                const r = Math.floor((Math.random() * 100) + 50); // Red value between 50 and 150
                const g = Math.floor((Math.random() * 100) + 50); // Green value between 50 and 150
                const b = Math.floor((Math.random() * 100) + 50); // Blue value between 50 and 150
            
                // Convert to hexadecimal format
                const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
                return hex;
            };
            const title = recommendation.title || 'Unknown Title';
            const authors = (recommendation.authors && recommendation.authors.length > 0) ? recommendation.authors.join(', ') : 'Unknown Author';

    
            // Fallback to a colored cover if the image is a placeholder or fails to load
            const onErrorFallback = (event) => {
                const parentElement = event.target.closest('.relative.group');
                const randomColor = generateRandomColor();
                parentElement.querySelector('img').remove(); // Remove the failed image
    
                parentElement.innerHTML += `
                    <div class="w-full h-60 flex flex-col justify-center items-center text-center p-4" style="background-color: ${randomColor};">
                        <h2 class="text-lg font-bold text-white">${recommendation.title}</h2>
                        <p class="text-gray-300">by ${recommendation.authors.join(', ')}</p>
                    </div>
                `;
            };
    
            // Check if the thumbnail is a Google Books placeholder
            const isPlaceholder = (url) => {
                return url.includes('books.google.com') && url.includes('150x150');
            };
    
            let thumbnail = recommendation.thumbnail;
            if (!thumbnail || isPlaceholder(thumbnail)) {
                thumbnail = 'invalid-url.jpg'; // This will trigger the onErrorFallback
            }
            
            const isbn = Array.isArray(recommendation.isbn) && recommendation.isbn.length > 0
            ? recommendation.isbn[0]
            : null;
            recommendationElement.innerHTML = `
                <div class="relative group book-card">
                    <a href="../html/book.html?isbn=${isbn}" class="block relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out group">
                        <img 
                            src="${thumbnail}?zoom=1" 
                            alt="${recommendation.title}" 
                            class="w-full h-full object-cover rounded-t-lg"
                        />
                        <div class="absolute bottom-0 left-0 w-full p-2 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
                            <h2 class="text-sm font-bold">${recommendation.title}</h2>
                            <p class="text-gray-300 text-xs">by ${authors}</p>
                        </div>
                    </a>
                </div>
            `;
    
            // Append the recommendation element to the container first
            recommendationsContainer.appendChild(recommendationElement);
    
            // Attach the onErrorFallback handler directly in JavaScript
            const imgElement = recommendationElement.querySelector('img');
            imgElement.addEventListener('error', onErrorFallback);
        });
    };
    
    
    
    
    const renderPlaceholderRecommendations = () => {
        recommendationsContainer.innerHTML = '';
        for (let i = 0; i < 10; i++) {
            const placeholderElement = document.createElement('div');
            placeholderElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow');
            placeholderElement.innerHTML = `
               <div class="relative group">
                    <div class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                        <div class="flex justify-center items-center h-72 w-40 mx-auto">
                            <span class="text-gray-500 text-xl">Empty Book</span>
                        </div>
                        <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                            <h2 class="text-lg font-bold">Book Title</h2>
                        </div>
                    </div>
                </div>
            `;
            recommendationsContainer.appendChild(placeholderElement);
        }
    };
    
    const renderOppositeRecommendations = (recommendations) => {
        oppRecommendationsContainer.innerHTML = '';
        recommendations.forEach(recommendation => {
            const recommendationElement = document.createElement('div');
            recommendationElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'book-card');
    
            // Function to generate a random color for the fallback cover
            const generateRandomColor = () => {
                const letters = '89ABCDEF'; // Limiting to pastel colors
                let color = '#';
                for (let i = 0; i < 6; i++) {
                    color += letters[Math.floor(Math.random() * letters.length)];
                }
                return color;
            };
    
            // Fallback to a colored cover if the image is a placeholder or fails to load
            const onErrorFallback = (event) => {
                const parentElement = event.target.closest('.relative.group');
                const randomColor = generateRandomColor();
                parentElement.querySelector('img').remove(); // Remove the failed image
    
                parentElement.innerHTML += `
                    <div class="w-full h-60 flex flex-col justify-center items-center text-center p-4" style="background-color: ${randomColor};">
                        <h2 class="text-lg font-bold text-white">${recommendation.title}</h2>
                        <p class="text-gray-300">by ${recommendation.authors.join(', ')}</p>
                    </div>
                `;
            };
    
            // Check if the thumbnail is a Google Books placeholder
            const isPlaceholder = (url) => {
                return url.includes('books.google.com') && url.includes('150x150');
            };
    
            let thumbnail = recommendation.thumbnail;
            if (!thumbnail || isPlaceholder(thumbnail)) {
                thumbnail = 'invalid-url.jpg'; // This will trigger the onErrorFallback
            }
            const isbn = Array.isArray(recommendation.isbn) && recommendation.isbn.length > 0
            ? recommendation.isbn[0]
            : 'no-isbn'; // Fallback if ISBN is missing
    
            recommendationElement.innerHTML = `
                <div class="relative group">
                    <a href="../html/book.html?isbn=${isbn}" class="block relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out group">
                        <img 
                            src="${thumbnail}?zoom=1" 
                            alt="${recommendation.title}" 
                            class="w-full h-72 object-cover"
                        />
                        <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                            <h2 class="text-lg font-bold">${recommendation.title}</h2>
                            <p class="text-gray-300">by ${recommendation.authors.join(', ')} </p>
                        </div>
                    </a>
                </div>
            `;
    
            oppRecommendationsContainer.appendChild(recommendationElement);
    
            // Attach the onErrorFallback handler directly in JavaScript
            const imgElement = recommendationElement.querySelector('img');
            imgElement.addEventListener('error', onErrorFallback);
        });
    };
    
    const fetchAndDisplayOppositeRecommendations = async () => {
        if (username) {
            const nextFetchTime = localStorage.getItem(nextFetchTimeKey);
    
            const storedOppRecommendations = JSON.parse(localStorage.getItem(oppRecommendationsKey));
            if (storedOppRecommendations && storedOppRecommendations.length > 0) {
                renderOppositeRecommendations(storedOppRecommendations);
            }
            // Start the countdown timer
            if (nextFetchTime && now < nextFetchTime) {
                startCountdown(nextFetchTime);
            } else {
                // If the timer is up or no fetch has been made yet, fetch new recommendations
                try {
                    const response = await fetch(`/api/opposite-recommendations/${username}`);
                    const data = await response.json();
    
                    console.log('Opposite Recommendations response:', data);
    
                    if (data.success && data.recommendations.length > 0) {
                        renderOppositeRecommendations(data.recommendations);
                        localStorage.setItem(oppRecommendationsKey, JSON.stringify(data.recommendations)); // Store new recommendations
                        localStorage.setItem(lastFetchTimeKey, now); // Update the fetch timestamp
                        const newNextFetchTime = now + timeThreshold;
                        localStorage.setItem(nextFetchTimeKey, newNextFetchTime); // Store the next fetch time
                        startCountdown(newNextFetchTime); // Start the countdown
                    } else {
                        console.error('No opposite recommendations found or failed to fetch recommendations:', data.message);
                    }
                } catch (error) {
                    console.error('Error fetching opposite recommendations:', error);
                }
            }
        } else {
            console.log('No username found in localStorage.');
        }
    };

    const startCountdown = (nextFetchTime) => {
        const countdownElement = document.getElementById('countdownTimer'); // Element to display the countdown
    
        const updateCountdown = () => {
            const now = new Date().getTime();
            const timeLeft = nextFetchTime - now;
    
            if (timeLeft <= 0) {
                countdownElement.textContent = "New recommendations will be available soon!";
                clearInterval(countdownInterval);
                return;
            }
    
            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
            countdownElement.textContent = `New recommendations in ${hours}h ${minutes}m ${seconds}s`;
            countdownElement.style.fontStyle = 'italic';

        };
    
        const countdownInterval = setInterval(updateCountdown, 1000); // Declare countdownInterval after updateCountdown
        updateCountdown(); // Initial call to display the countdown immediately
    };
    
    

    // Fetch and display opposite recommendations on page load
    fetchAndDisplayOppositeRecommendations();

    if (username) {
        const savedRecommendationsKey = `${username}_recommendations`;
        const savedRecommendations = localStorage.getItem(savedRecommendationsKey);
        if (savedRecommendations) {
            const parsedRecommendations = JSON.parse(savedRecommendations);
            if (parsedRecommendations && parsedRecommendations.length > 0) {
                renderRecommendations(parsedRecommendations);
            }
            else {
                renderPlaceholderRecommendations();
            }
        } else {
            renderPlaceholderRecommendations();
        }
    

        generateButton.addEventListener('click', async () => {
            if (!generateButton.classList.contains('racing-glow')) {
                generateButton.classList.add('racing-glow'); // Add the racing border animation
                generateButton.textContent = 'Generating Recommendations...';
            }
            generateButton.disabled = true;
            const now = Date.now();
            generateButton.classList.remove('glow-button');
        
            if (now - clickData.lastReset >= limitResetTime) {
                clickData.count = 0;
                clickData.lastReset = now;
                updateClickData(clickData);
            }
        
            if (!bypassLimit) {
                if (clickData.count >= clickLimit) {
                    const timeUntilReset = limitResetTime - (now - clickData.lastReset);
                    startGenerateCountdown(timeUntilReset);
                    generateButton.classList.remove('glow-button');
        
                    console.log('Click limit reached. Please wait until the countdown ends.');
                    return;
                }
                clickData.count += 1;
                updateClickData(clickData);
                updateRecommendationStatus(clickData);
            }
        
            try {
                
                    response = await fetch(`/api/recommendations/${username}`);
                
        
                const data = await response.json();
        
                if (data.success && data.recommendations.length > 0) {
                    localStorage.setItem(`${username}_recommendations`, JSON.stringify(data.recommendations));
                    renderRecommendations(data.recommendations);
                } else {
                    console.error('No recommendations found or failed to fetch recommendations:', data.message);
                }
            } catch (error) {
                renderPlaceholderRecommendations();
                console.error('Error fetching recommendations:', error);
            } finally {
                hideSparkles();
                generateButton.classList.remove('racing-glow'); // Remove the racing border animation
                generateButton.classList.add('glow-button');
                generateButton.textContent = 'Generate Recommendations'; // Reset the text
                generateButton.disabled = false; // Re-enable the button
            }
        });
        
} else {
    // Fetch and display blurred sample books for non-logged-in users
    fetch('/api/sample-books')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                recommendationsContainer.innerHTML = `
                    <div class="relative">
                        <div class="filter blur-md flex overflow-x-auto space-x-4 p-4 scrollbar-hide">
                            ${data.books.map(book => `
                                <div class="recommendation-card p-4 bg-gray-100 rounded shadow">
                                    <div class="relative group">
                                        <div class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                                            <img 
                                                src="${book.thumbnail}" 
                                                alt="${book.title}" 
                                                class="w-full h-72 object-cover"
                                            />
                                            <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white">
                                                <h2 class="text-lg font-bold">${book.title}</h2>
                                                <p class="text-gray-300">by ${book.authors.join(', ')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="absolute inset-0 flex items-center justify-center z-10">
                            <a href="../html/login.html" class="px-6 py-3 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 transition-colors duration-200 font-semibold text-lg">
                                Login to View Recommendations
                            </a>
                        </div>
                    </div>
                `;
            } else {
                // Fallback to static placeholder if API call fails
                renderPlaceholderRecommendations();
            }
        })
        .catch(error => {
            console.error('Error fetching sample books:', error);
            renderPlaceholderRecommendations();
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
    scrollLeftYA.addEventListener('click', () => {
        yadultContainer.scrollBy({
            top: 0,
            left: -recommendationsContainer.clientWidth,
            behavior: 'smooth'
        });
    });

    scrollRightYA.addEventListener('click', () => {
        yadultContainer.scrollBy({
            top: 0,
            left: recommendationsContainer.clientWidth,
            behavior: 'smooth'
        });
    });

    scrollLeftNF.addEventListener('click', () => {
        nonfictionContainer.scrollBy({
            top: 0,
            left: -recommendationsContainer.clientWidth,
            behavior: 'smooth'
        });
    });

    scrollRightNF.addEventListener('click', () => {
        nonfictionContainer.scrollBy({
            top: 0,
            left: recommendationsContainer.clientWidth,
            behavior: 'smooth'
        });
    });

    

    scrollLeftButton_nyt.addEventListener('click', () => {
        bestSellersContainer.scrollBy({
            top: 0,
            left: -recommendationsContainer.clientWidth,
            behavior: 'smooth'
        });
    });

    scrollRightButton_nyt.addEventListener('click', () => {
        bestSellersContainer.scrollBy({
            top: 0,
            left: recommendationsContainer.clientWidth,
            behavior: 'smooth'
        });
    });

    scrollLeft_OppRec.addEventListener('mouseenter', () => showArrow(scrollLeft_OppRec));
    scrollLeft_OppRec.addEventListener('mouseleave', () => hideArrow(scrollLeft_OppRec));

    scrollRight_OppRec.addEventListener('mouseenter', () => showArrow(scrollRight_OppRec));
    scrollRight_OppRec.addEventListener('mouseleave', () => hideArrow(scrollRight_OppRec));

    scrollLeft_OppRec.addEventListener('click', () => {
        oppRecommendationsContainer.scrollBy({
            top: 0,
            left: -oppRecommendationsContainer.clientWidth,
            behavior: 'smooth'
        });
    });

    scrollRight_OppRec.addEventListener('click', () => {
        oppRecommendationsContainer.scrollBy({
            top: 0,
            left: oppRecommendationsContainer.clientWidth,
            behavior: 'smooth'
        });
    });


// Add these constants at the top of your index.js file
const NYT_CACHE_DURATION = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds
const CACHE_KEYS = {
    FICTION: 'nyt_fiction_cache',
    YA: 'nyt_ya_cache',
    NONFICTION: 'nyt_nonfiction_cache',
    SERIES: 'series_cache',
    BUSINESS: 'business_cache',
    PHILOSOPHY: 'philosophy_cache',
    LAST_FETCH: 'nyt_last_fetch'
};

// Helper function to check if cache is valid
function isCacheValid() {
    const lastFetch = localStorage.getItem(CACHE_KEYS.LAST_FETCH);
    if (!lastFetch) return false;
    
    const now = new Date().getTime();
    return (now - parseInt(lastFetch)) < NYT_CACHE_DURATION;
}

// Modified fetch functions to use caching
async function fetchNYTimesBestSellers() {
    // Check cache first
    if (isCacheValid()) {
        const cachedData = localStorage.getItem(CACHE_KEYS.FICTION);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
    }

    // If cache is invalid or doesn't exist, fetch new data
    try {
        const apiKey = '07KGzNSRt9XlvFc8Esd006b7fqiGA8cc'; 
        const response = await fetch(`https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json?api-key=${apiKey}`);
        const data = await response.json();
        
        const processedData = data.results.books.map(book => ({
            title: book.title,
            authors: book.author,
            thumbnail: book.book_image,
            isbn: book.primary_isbn13
        }));

        // Cache the new data
        localStorage.setItem(CACHE_KEYS.FICTION, JSON.stringify(processedData));
        localStorage.setItem(CACHE_KEYS.LAST_FETCH, new Date().getTime().toString());
        
        return processedData;
    } catch (error) {
        console.error('Error fetching NY Times Best Sellers:', error);
        // If fetch fails, try to use cached data even if expired
        const cachedData = localStorage.getItem(CACHE_KEYS.FICTION);
        return cachedData ? JSON.parse(cachedData) : [];
    }
}

async function fetchNYTimesyadult() {
    // Check cache first
    if (isCacheValid()) {
        const cachedData = localStorage.getItem(CACHE_KEYS.YA);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
    }

    try {
        const apiKey = 'Glpuj6w9AxVo6kx0vpfy8x3hdBr10eHu';
        const response = await fetch(`https://api.nytimes.com/svc/books/v3/lists/current/young-adult-hardcover.json?api-key=${apiKey}`);
        const data = await response.json();
        
        const processedData = data.results.books.map(book => ({
            title: book.title,
            authors: book.author,
            thumbnail: book.book_image,
            isbn: book.primary_isbn13
        }));

        // Cache the new data
        localStorage.setItem(CACHE_KEYS.YA, JSON.stringify(processedData));
        localStorage.setItem(CACHE_KEYS.LAST_FETCH, new Date().getTime().toString());
        
        return processedData;
    } catch (error) {
        console.error('Error fetching NY Times young adult books:', error);
        const cachedData = localStorage.getItem(CACHE_KEYS.YA);
        return cachedData ? JSON.parse(cachedData) : [];
    }
}

async function fetchNF() {
    // Check cache first
    if (isCacheValid()) {
        const cachedData = localStorage.getItem(CACHE_KEYS.NONFICTION);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
    }

    try {
        const apiKey = 'Glpuj6w9AxVo6kx0vpfy8x3hdBr10eHu';
        const response = await fetch(`https://api.nytimes.com/svc/books/v3/lists/current/hardcover-nonfiction.json?api-key=${apiKey}`);
        const data = await response.json();
        
        const processedData = data.results.books.map(book => ({
            title: book.title,
            authors: book.author,
            thumbnail: book.book_image,
            isbn: book.primary_isbn13
        }));

        // Cache the new data
        localStorage.setItem(CACHE_KEYS.NONFICTION, JSON.stringify(processedData));
        localStorage.setItem(CACHE_KEYS.LAST_FETCH, new Date().getTime().toString());
        
        return processedData;
    } catch (error) {
        console.error('Error fetching NY Times nonfiction books:', error);
        const cachedData = localStorage.getItem(CACHE_KEYS.NONFICTION);
        return cachedData ? JSON.parse(cachedData) : [];
    }
}

// Update the fetch calls in your existing code
fetchNYTimesBestSellers().then(books => {
    renderNYTimesBestSellers(books);
}).catch(error => {
    console.error('Error handling NY Times Best Sellers:', error);
    renderPlaceholderRecommendations();
});

fetchNYTimesyadult().then(books => {
    renderNYTimesyadult(books);
}).catch(error => {
    console.error('Error handling NY Times young adult books:', error);
    renderPlaceholderRecommendations();
});

fetchNF().then(books => {
    renderNF(books);
}).catch(error => {
    console.error('Error handling NY Times nonfiction books:', error);
    renderPlaceholderRecommendations();
});


// logic for cylcing lists: 1. need to create the render lists helper method ( you guys have already done this in your code just make a general function to render lists)
//2. the generateNewLists function which will store all the lists and only output 2 at a time
// 3. call the fucntion 'fetch and display lists; in the dom 
//4. test (there will be errors)

const fetchAndDisplayLists = async () => {
    if (username) {
        const nextFetchTime = localStorage.getItem(nextFetchTimeKey);

        // Logic to manage list display
        const storedLists = localStorage.getItem(listsKey); // Retrieve stored lists from localStorage
        const parsedLists = storedLists ? JSON.parse(storedLists) : []; // Parse lists if available

        // Check if there are existing lists and display a set
        if (parsedLists && parsedLists.length > 0) {
            // Example: Display the current 2 out of 8 lists
            // Use your existing helper methods to render the lists
            renderLists(parsedLists); // Assuming renderLists is a helper method you have
        }

        // Start the countdown timer
        if (nextFetchTime && now < nextFetchTime) {
            startCountdown(nextFetchTime);
        } else {
            // If the timer is up or no fetch has been made yet, cycle to the next set of lists
            try {
                // Example: Logic to cycle through lists
                // Use your existing logic to select the next 2 lists out of 8
                // For example, rotate through the lists every 3 hours:
                /*
                  1. Determine the current set of lists to display
                  2. Use a modulo operation to cycle through the list index
                  3. Store the index in localStorage and update it as needed
                */
                const listIndex = parseInt(localStorage.getItem(listIndexKey)) || 0;
                const nextIndex = (listIndex + 2) % 8; // Cycle through sets of 2 lists
                localStorage.setItem(listIndexKey, nextIndex); // Update the index

                // Fetch or generate new lists if necessary
                // For now, this is represented with comments:
                // Example: fetch(`/api/lists/${username}`) or similar logic

                // Simulated new list generation (replace with actual logic)
                const newLists = generateNewLists(); // Placeholder for your list generation logic
                renderLists(newLists); // Render the new set of lists

                localStorage.setItem(listsKey, JSON.stringify(newLists)); // Store new lists
                localStorage.setItem(lastFetchTimeKey, now); // Update the fetch timestamp
                const newNextFetchTime = now + timeThreshold; // 3 hours later
                localStorage.setItem(nextFetchTimeKey, newNextFetchTime); // Store the next fetch time
                startCountdown(newNextFetchTime); // Start the countdown
            } catch (error) {
                console.error('Error cycling through lists:', error);
            }
        }
    } else {
        console.log('No username found in localStorage.');
    }
};

// Placeholder method to generate new lists (replace with your actual list generation logic)
const generateNewLists = () => {
    // Example: Return a set of 2 out of 8 lists
    return [
        { id: 1, name: 'List 1' },
        { id: 2, name: 'List 2' }
        // Add logic to select the appropriate lists based on your requirements
    ];
};

// Render functions for NYT lists
const renderNYTimesBestSellers = (books) => {
    bestSellersContainer.innerHTML = '';
    books.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'book-card');

        const generateRandomColor = () => {
            const letters = '89ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * letters.length)];
            }
            return color;
        };

        const onErrorFallback = (event) => {
            const parentElement = event.target.closest('.relative.group');
            const randomColor = generateRandomColor();
            parentElement.querySelector('img').remove();

            parentElement.innerHTML += `
                <div class="w-full h-60 flex flex-col justify-center items-center text-center p-4" style="background-color: ${randomColor};">
                    <h2 class="text-lg font-bold text-white">${book.title}</h2>
                    <p class="text-gray-300">by ${book.authors}</p>
                </div>
            `;
        };

        bookElement.innerHTML = `
            <div class="relative group book-card">
                <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out group">
                    <img 
                        src="${book.thumbnail}" 
                        alt="${book.title}" 
                        class="w-full h-full object-cover rounded-t-lg"
                    />
                    <div class="absolute bottom-0 left-0 w-full p-2 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
                        <h2 class="text-sm font-bold">${book.title}</h2>
                        <p class="text-gray-300 text-xs">by ${book.authors}</p>
                    </div>
                </a>
            </div>
        `;

        bestSellersContainer.appendChild(bookElement);

        const imgElement = bookElement.querySelector('img');
        imgElement.addEventListener('error', onErrorFallback);
    });
};

const renderNYTimesyadult = (books) => {
    yadultContainer.innerHTML = '';
    books.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'book-card');

        const generateRandomColor = () => {
            const letters = '89ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * letters.length)];
            }
            return color;
        };

        const onErrorFallback = (event) => {
            const parentElement = event.target.closest('.relative.group');
            const randomColor = generateRandomColor();
            parentElement.querySelector('img').remove();

            parentElement.innerHTML += `
                <div class="w-full h-60 flex flex-col justify-center items-center text-center p-4" style="background-color: ${randomColor};">
                    <h2 class="text-lg font-bold text-white">${book.title}</h2>
                    <p class="text-gray-300">by ${book.authors}</p>
                </div>
            `;
        };

        bookElement.innerHTML = `
            <div class="relative group book-card">
                <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out group">
                    <img 
                        src="${book.thumbnail}" 
                        alt="${book.title}" 
                        class="w-full h-full object-cover rounded-t-lg"
                    />
                    <div class="absolute bottom-0 left-0 w-full p-2 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
                        <h2 class="text-sm font-bold">${book.title}</h2>
                        <p class="text-gray-300 text-xs">by ${book.authors}</p>
                    </div>
                </a>
            </div>
        `;

        yadultContainer.appendChild(bookElement);

        const imgElement = bookElement.querySelector('img');
        imgElement.addEventListener('error', onErrorFallback);
    });
};

const renderNF = (books) => {
    nonfictionContainer.innerHTML = '';
    books.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'book-card');

        const generateRandomColor = () => {
            const letters = '89ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * letters.length)];
            }
            return color;
        };

        const onErrorFallback = (event) => {
            const parentElement = event.target.closest('.relative.group');
            const randomColor = generateRandomColor();
            parentElement.querySelector('img').remove();

            parentElement.innerHTML += `
                <div class="w-full h-60 flex flex-col justify-center items-center text-center p-4" style="background-color: ${randomColor};">
                    <h2 class="text-lg font-bold text-white">${book.title}</h2>
                    <p class="text-gray-300">by ${book.authors}</p>
                </div>
            `;
        };

        bookElement.innerHTML = `
            <div class="relative group book-card">
                <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out group">
                    <img 
                        src="${book.thumbnail}" 
                        alt="${book.title}" 
                        class="w-full h-full object-cover rounded-t-lg"
                    />
                    <div class="absolute bottom-0 left-0 w-full p-2 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
                        <h2 class="text-sm font-bold">${book.title}</h2>
                        <p class="text-gray-300 text-xs">by ${book.authors}</p>
                    </div>
                </a>
            </div>
        `;

        nonfictionContainer.appendChild(bookElement);

        const imgElement = bookElement.querySelector('img');
        imgElement.addEventListener('error', onErrorFallback);
    });
};

// Add these new functions after the existing fetch functions
async function fetchSeriesRecommendations() {
    // Check cache first
    if (isCacheValid()) {
        const cachedData = localStorage.getItem(CACHE_KEYS.SERIES);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
    }

    try {
        // Use our dedicated endpoint instead of direct API calls
        const response = await fetch('/api/series-recommendations');
        const data = await response.json();
        
        if (data.success && data.books) {
            // Cache the new data
            localStorage.setItem(CACHE_KEYS.SERIES, JSON.stringify(data.books));
            localStorage.setItem(CACHE_KEYS.LAST_FETCH, new Date().getTime().toString());
            return data.books;
        } else {
            console.error('Error fetching series recommendations:', data.message);
            // If fetch fails, try to use cached data even if expired
            const cachedData = localStorage.getItem(CACHE_KEYS.SERIES);
            return cachedData ? JSON.parse(cachedData) : [];
        }
    } catch (error) {
        console.error('Error fetching series recommendations:', error);
        // If fetch fails, try to use cached data even if expired
        const cachedData = localStorage.getItem(CACHE_KEYS.SERIES);
        return cachedData ? JSON.parse(cachedData) : [];
    }
}

async function fetchBusinessBooks() {
    if (isCacheValid()) {
        const cachedData = localStorage.getItem(CACHE_KEYS.BUSINESS);
        if (cachedData) {
            return JSON.parse(cachedData);
        }
    }

    try {
        const allBooks = [];

        // Fetch from NYT Business Books
        const nytResponse = await fetch('https://api.nytimes.com/svc/books/v3/lists/current/business-books.json?api-key=07KGzNSRt9XlvFc8Esd006b7fqiGA8cc');
        const nytData = await nytResponse.json();
        
        if (nytData.results && nytData.results.books) {
            allBooks.push(...nytData.results.books.map(book => ({
                title: book.title,
                authors: [book.author],
                thumbnail: book.book_image,
                isbn: book.primary_isbn13,
                description: book.description || 'No description available',
                popularity: {
                    isBestseller: true,
                    weeksOnList: book.weeks_on_list || 0,
                    rank: book.rank || 999
                }
            })));
        }

        // Fetch from NYT Advice, How-To & Miscellaneous
        const nytAdviceResponse = await fetch('https://api.nytimes.com/svc/books/v3/lists/current/advice-how-to-and-miscellaneous.json?api-key=07KGzNSRt9XlvFc8Esd006b7fqiGA8cc');
        const nytAdviceData = await nytAdviceResponse.json();
        
        if (nytAdviceData.results && nytAdviceData.results.books) {
            allBooks.push(...nytAdviceData.results.books.map(book => ({
                title: book.title,
                authors: [book.author],
                thumbnail: book.book_image,
                isbn: book.primary_isbn13,
                description: book.description || 'No description available',
                popularity: {
                    isBestseller: true,
                    weeksOnList: book.weeks_on_list || 0,
                    rank: book.rank || 999
                }
            })));
        }

        // Fetch from OpenLibrary Business Books
        const openLibraryResponse = await fetch('https://openlibrary.org/subjects/business.json?limit=20');
        const openLibraryData = await openLibraryResponse.json();
        
        if (openLibraryData.works) {
            allBooks.push(...openLibraryData.works.map(work => ({
                title: work.title,
                authors: work.authors ? work.authors.map(author => author.name) : ['Unknown Author'],
                thumbnail: `https://covers.openlibrary.org/b/id/${work.cover_id}-L.jpg`,
                isbn: work.isbn || 'no-isbn',
                description: work.description || 'No description available',
                popularity: {
                    rating: work.rating?.average || 0,
                    ratingsCount: work.rating?.count || 0,
                    isBestseller: false
                }
            })));
        }

        // Fetch from Google Books API with popularity filters
        const businessQuery = 'subject:"business" OR subject:"management" OR subject:"leadership" OR subject:"entrepreneurship" OR subject:"professional development"';
        
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${businessQuery}&maxResults=40&orderBy=relevance&key=AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8`);
        const data = await response.json();
        if (data.items) {
            allBooks.push(...data.items.map(book => ({
                title: book.volumeInfo.title,
                authors: book.volumeInfo.authors || ['Unknown Author'],
                thumbnail: book.volumeInfo.imageLinks?.thumbnail || 'https://via.placeholder.com/128x192?text=No+Image',
                isbn: book.volumeInfo.industryIdentifiers?.[0]?.identifier || 'no-isbn',
                description: book.volumeInfo.description || 'No description available',
                popularity: {
                    rating: book.volumeInfo.averageRating || 0,
                    ratingsCount: book.volumeInfo.ratingsCount || 0,
                    isBestseller: false
                }
            })));
        }

        // Filter and sort books by popularity
        const filteredBooks = allBooks.filter(book => {
            // Keep NYT bestsellers
            if (book.popularity.isBestseller) return true;
            
            // For other sources, require minimum ratings and rating score
            if (book.popularity.ratingsCount >= 50 && book.popularity.rating >= 3.8) return true;
            
            return false;
        });

        // Sort by popularity metrics
        const sortedBooks = filteredBooks.sort((a, b) => {
            // NYT bestsellers first
            if (a.popularity.isBestseller && !b.popularity.isBestseller) return -1;
            if (!a.popularity.isBestseller && b.popularity.isBestseller) return 1;
            
            // Then by weeks on list for NYT books
            if (a.popularity.isBestseller && b.popularity.isBestseller) {
                return a.popularity.weeksOnList - b.popularity.weeksOnList;
            }
            
            // Then by rating and number of ratings for other sources
            const aScore = a.popularity.rating * Math.log(a.popularity.ratingsCount + 1);
            const bScore = b.popularity.rating * Math.log(b.popularity.ratingsCount + 1);
            return bScore - aScore;
        });

        // Remove duplicates based on ISBN
        const uniqueBooks = Array.from(new Map(sortedBooks.map(book => [book.isbn, book])).values());

        // Cache the results
        localStorage.setItem(CACHE_KEYS.BUSINESS, JSON.stringify(uniqueBooks));
        localStorage.setItem(CACHE_KEYS.LAST_FETCH, new Date().getTime().toString());
        
        return uniqueBooks;
    } catch (error) {
        console.error('Error fetching business books:', error);
        const cachedData = localStorage.getItem(CACHE_KEYS.BUSINESS);
        return cachedData ? JSON.parse(cachedData) : [];
    }
}

// Add these new render functions
const renderSeriesRecommendations = (books) => {
    const seriesContainer = document.getElementById('seriesContainer');
    seriesContainer.innerHTML = '';
    books.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'book-card');

        const generateRandomColor = () => {
            const letters = '89ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * letters.length)];
            }
            return color;
        };

        const onErrorFallback = (event) => {
            const parentElement = event.target.closest('.relative.group');
            const randomColor = generateRandomColor();
            parentElement.querySelector('img').remove();

            parentElement.innerHTML += `
                <div class="w-full h-60 flex flex-col justify-center items-center text-center p-4" style="background-color: ${randomColor};">
                    <h2 class="text-lg font-bold text-white">${book.title}</h2>
                    <p class="text-gray-300">by ${book.authors.join(', ')}</p>
                </div>
            `;
        };

        bookElement.innerHTML = `
            <div class="relative group book-card">
                <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out group">
                    <img 
                        src="${book.thumbnail}" 
                        alt="${book.title}" 
                        class="w-full h-full object-cover rounded-t-lg"
                    />
                    <div class="absolute bottom-0 left-0 w-full p-2 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
                        <h2 class="text-sm font-bold">${book.title}</h2>
                        <p class="text-gray-300 text-xs">by ${book.authors.join(', ')}</p>
                    </div>
                </a>
            </div>
        `;

        seriesContainer.appendChild(bookElement);

        const imgElement = bookElement.querySelector('img');
        imgElement.addEventListener('error', onErrorFallback);
    });
};

const renderBusinessBooks = (books) => {
    const businessContainer = document.getElementById('businessContainer');
    businessContainer.innerHTML = '';
    books.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'book-card');

        const generateRandomColor = () => {
            const letters = '89ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * letters.length)];
            }
            return color;
        };

        const onErrorFallback = (event) => {
            const parentElement = event.target.closest('.relative.group');
            const randomColor = generateRandomColor();
            parentElement.querySelector('img').remove();

            parentElement.innerHTML += `
                <div class="w-full h-60 flex flex-col justify-center items-center text-center p-4" style="background-color: ${randomColor};">
                    <h2 class="text-lg font-bold text-white">${book.title}</h2>
                    <p class="text-gray-300">by ${book.authors.join(', ')}</p>
                </div>
            `;
        };

        bookElement.innerHTML = `
            <div class="relative group book-card">
                <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out group">
                    <img 
                        src="${book.thumbnail}" 
                        alt="${book.title}" 
                        class="w-full h-full object-cover rounded-t-lg"
                    />
                    <div class="absolute bottom-0 left-0 w-full p-2 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
                        <h2 class="text-sm font-bold">${book.title}</h2>
                        <p class="text-gray-300 text-xs">by ${book.authors.join(', ')}</p>
                    </div>
                </a>
            </div>
        `;

        businessContainer.appendChild(bookElement);

        const imgElement = bookElement.querySelector('img');
        imgElement.addEventListener('error', onErrorFallback);
    });
};

// Add these new scroll event listeners
document.getElementById('scrollLeftSeries').addEventListener('click', () => {
    document.getElementById('seriesContainer').scrollBy({
        top: 0,
        left: -document.getElementById('seriesContainer').clientWidth,
        behavior: 'smooth'
    });
});

document.getElementById('scrollRightSeries').addEventListener('click', () => {
    document.getElementById('seriesContainer').scrollBy({
        top: 0,
        left: document.getElementById('seriesContainer').clientWidth,
        behavior: 'smooth'
    });
});

document.getElementById('scrollLeftBusiness').addEventListener('click', () => {
    document.getElementById('businessContainer').scrollBy({
        top: 0,
        left: -document.getElementById('businessContainer').clientWidth,
        behavior: 'smooth'
    });
});

document.getElementById('scrollRightBusiness').addEventListener('click', () => {
    document.getElementById('businessContainer').scrollBy({
        top: 0,
        left: document.getElementById('businessContainer').clientWidth,
        behavior: 'smooth'
    });
});

// Add these new fetch calls to your existing fetch calls
fetchSeriesRecommendations().then(books => {
    renderSeriesRecommendations(books);
}).catch(error => {
    console.error('Error handling series recommendations:', error);
    renderPlaceholderRecommendations();
});

fetchBusinessBooks().then(books => {
    renderBusinessBooks(books);
}).catch(error => {
    console.error('Error handling business books:', error);
    renderPlaceholderRecommendations();
});

async function fetchPhilosophyBooks() {
    try {
        const allBooks = [];

        // Fetch from NYT Philosophy & Religion list
        const nytResponse = await fetch('https://api.nytimes.com/svc/books/v3/lists/current/philosophy-religion.json?api-key=07KGzNSRt9XlvFc8Esd006b7fqiGA8cc');
        const nytData = await nytResponse.json();
        
        if (nytData.results && nytData.results.books) {
            allBooks.push(...nytData.results.books.map(book => ({
                title: book.title,
                authors: [book.author],
                thumbnail: book.book_image,
                isbn: book.primary_isbn13,
                description: book.description || 'No description available',
                popularity: {
                    isBestseller: true,
                    weeksOnList: book.weeks_on_list || 0,
                    rank: book.rank || 999
                }
            })));
        }

        // Fetch from Google Books API with philosophical themes
        const philosophyQueries = [
            'subject:"philosophy"',
            'subject:"ethics"',
            'subject:"existentialism"',
            'subject:"stoicism"',
            'subject:"mindfulness"',
            'subject:"consciousness"',
            'subject:"meaning of life"',
            'subject:"critical thinking"',
            'subject:"logic"',
            'subject:"metaphysics"'
        ];
        
        for (const query of philosophyQueries) {
            const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=20&orderBy=relevance&key=AIzaSyCFDaqjpgA8K_NqqCw93xorS3zumc_52u8`);
            const data = await response.json();
            if (data.items) {
                allBooks.push(...data.items.map(book => ({
                    title: book.volumeInfo.title,
                    authors: book.volumeInfo.authors || ['Unknown Author'],
                    thumbnail: book.volumeInfo.imageLinks?.thumbnail || 'https://via.placeholder.com/128x192?text=No+Image',
                    isbn: book.volumeInfo.industryIdentifiers?.[0]?.identifier || 'no-isbn',
                    description: book.volumeInfo.description || 'No description available',
                    popularity: {
                        rating: book.volumeInfo.averageRating || 0,
                        ratingsCount: book.volumeInfo.ratingsCount || 0,
                        isBestseller: false
                    }
                })));
            }
        }

        // Filter and sort books by popularity and recency
        const filteredBooks = allBooks.filter(book => {
            // Keep NYT bestsellers
            if (book.popularity.isBestseller) return true;
            
            // For other sources, require minimum ratings and rating score
            if (book.popularity.ratingsCount >= 50 && book.popularity.rating >= 3.8) return true;
            
            return false;
        });

        // Sort by popularity metrics
        const sortedBooks = filteredBooks.sort((a, b) => {
            // NYT bestsellers first
            if (a.popularity.isBestseller && !b.popularity.isBestseller) return -1;
            if (!a.popularity.isBestseller && b.popularity.isBestseller) return 1;
            
            // Then by weeks on list for NYT books
            if (a.popularity.isBestseller && b.popularity.isBestseller) {
                return a.popularity.weeksOnList - b.popularity.weeksOnList;
            }
            
            // Then by rating and number of ratings for other sources
            const aScore = a.popularity.rating * Math.log(a.popularity.ratingsCount + 1);
            const bScore = b.popularity.rating * Math.log(b.popularity.ratingsCount + 1);
            return bScore - aScore;
        });

        // Remove duplicates based on ISBN
        const uniqueBooks = Array.from(new Map(sortedBooks.map(book => [book.isbn, book])).values());
        
        return uniqueBooks;
    } catch (error) {
        console.error('Error fetching philosophy books:', error);
        return [];
    }
}

const renderPhilosophyBooks = (books) => {
    const philosophyContainer = document.getElementById('philosophyContainer');
    philosophyContainer.innerHTML = '';
    books.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'book-card');

        const generateRandomColor = () => {
            const letters = '89ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * letters.length)];
            }
            return color;
        };

        const onErrorFallback = (event) => {
            const parentElement = event.target.closest('.relative.group');
            const randomColor = generateRandomColor();
            parentElement.querySelector('img').remove();

            parentElement.innerHTML += `
                <div class="w-full h-60 flex flex-col justify-center items-center text-center p-4" style="background-color: ${randomColor};">
                    <h2 class="text-lg font-bold text-white">${book.title}</h2>
                    <p class="text-gray-300">by ${book.authors.join(', ')}</p>
                </div>
            `;
        };

        bookElement.innerHTML = `
            <div class="relative group book-card">
                <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-md hover:shadow-lg transition duration-200 ease-in-out group">
                    <img 
                        src="${book.thumbnail}" 
                        alt="${book.title}" 
                        class="w-full h-full object-cover rounded-t-lg"
                    />
                    <div class="absolute bottom-0 left-0 w-full p-2 bg-black bg-opacity-50 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 ease-in-out">
                        <h2 class="text-sm font-bold">${book.title}</h2>
                        <p class="text-gray-300 text-xs">by ${book.authors.join(', ')}</p>
                    </div>
                </a>
            </div>
        `;

        philosophyContainer.appendChild(bookElement);

        const imgElement = bookElement.querySelector('img');
        imgElement.addEventListener('error', onErrorFallback);
    });
};

// Add scroll event listeners for philosophy section
document.getElementById('scrollLeftPhilosophy').addEventListener('click', () => {
    document.getElementById('philosophyContainer').scrollBy({
        top: 0,
        left: -document.getElementById('philosophyContainer').clientWidth,
        behavior: 'smooth'
    });
});

document.getElementById('scrollRightPhilosophy').addEventListener('click', () => {
    document.getElementById('philosophyContainer').scrollBy({
        top: 0,
        left: document.getElementById('philosophyContainer').clientWidth,
        behavior: 'smooth'
    });
});

// Add this to your existing fetch calls
fetchPhilosophyBooks().then(books => {
    renderPhilosophyBooks(books);
}).catch(error => {
    console.error('Error handling philosophy books:', error);
    renderPlaceholderRecommendations();
});

});