document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generateRecommendationsButton');
    const scrollLeftButton = document.getElementById('scrollLeft');
    const scrollRightButton = document.getElementById('scrollRight');
    const scrollLeftButton_nyt = document.getElementById('scrollLeft_nyt');
    const scrollRightButton_nyt = document.getElementById('scrollRight_nyt');
    const username = localStorage.getItem('username'); // Ensure the username is stored in localStorage

    const recommendationsContainer = document.getElementById('recommendationsContainer');
    const loadingSpinner = document.getElementById('loadingSpinner'); // Ensure this element exists
    const sparkleContainer = document.getElementById('sparkleContainer');
    const bestSellersContainer = document.getElementById('bestSellersContainer');
    
    const comRecommendationsContainer = document.getElementById('comRecommendationsContainer');
    
    const oppRecommendationsContainer = document.getElementById('oppRecommendationsContainer');
    const scrollLeft_OppRec = document.getElementById('scrollLeft_OppRec');
    const scrollRight_OppRec = document.getElementById('scrollRight_OppRec');

    const lastFetchTimeKey = `${username}_lastFetchTime`;
    const nextFetchTimeKey = `${username}_nextFetchTime`;
    const recommendationsKey = `${username}_recommendations`;
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
    

    const startGenerateCountdown = (timeLeft) => {
        const countdownElement = document.getElementById('countdownTimer_rec'); // Use the new ID for countdown timer
    
        const updateCountdown = () => {
            const currentTime = new Date().getTime();
            const timeRemaining = timeLeft - (currentTime - clickData.lastReset);
    
            if (timeRemaining <= 0) {
                countdownElement.textContent = "You can generate recommendations again!";
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
    
            recommendationElement.innerHTML = `
                <div class="relative group book-card">
                    <a href="../html/book.html?isbn=${recommendation.isbn[0]}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
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
    
            recommendationElement.innerHTML = `
                <div class="relative group">
                    <a href="../html/book.html?isbn=${recommendation.isbn[0]}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
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
    
            // Display existing recommendations if available
            if (storedRecommendations && storedRecommendations.length > 0) {
                renderOppositeRecommendations(storedRecommendations);
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
                        localStorage.setItem(recommendationsKey, JSON.stringify(data.recommendations)); // Store new recommendations
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
            // Proceed with generating recommendations
            try {
                //showSparkles();
                const response = await fetch(`/api/recommendations/${username}`);
                const data = await response.json();
    
                console.log('Recommendations response:', data);
    
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


            }
        });
}      else{
    renderPlaceholderRecommendations();
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


async function fetchNYTimesBestSellers() {
    const apiKey = '07KGzNSRt9XlvFc8Esd006b7fqiGA8cc'; // Replace with your actual API key
    const response = await fetch(`https://api.nytimes.com/svc/books/v3/lists/current/hardcover-fiction.json?api-key=${apiKey}`);
    const data = await response.json();
    return data.results.books.map(book => ({
        title: book.title,
        authors: book.author,
        thumbnail: book.book_image,
        isbn: book.primary_isbn13
    }));
}

fetchNYTimesBestSellers().then(books => {
    renderNYTimesBestSellers(books);
}).catch(error => {
    console.error('Error fetching NY Times Best Sellers:', error);
    renderPlaceholderRecommendations();
});



const renderNYTimesBestSellers = (books) => {
    bestSellersContainer.innerHTML = '';
    books.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.classList.add('nyt-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'book-card');
        bookElement.innerHTML = `
            <div class="relative group">
                <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                    <img src="${book.thumbnail}" alt="${book.title}" class="w-30 h-30 object-cover">
                    <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                        <h2 class="text-lg font-bold">${book.title}</h2>
                        <p class="text-gray-300">by ${book.authors}</p>
                    </div>
                </a>
            </div>
        `;
        bestSellersContainer.appendChild(bookElement);
    });
};




const renderComRecs = (recommendation) => {
    comRecommendationsContainer.innerHTML = '';
    recommendation.forEach(book => {
        const bookElement = document.createElement('div');
        bookElement.classList.add('recommendation-card', 'p-4', 'bg-gray-100', 'rounded', 'shadow', 'book-card');
        bookElement.innerHTML = `
            <div class="relative group">
                <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group">
                    <img src="${book.thumbnail}" alt="${book.title}" class="w-30 h-30 object-cover">
                    <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                        <h2 class="text-lg font-bold">${book.title}</h2>
                        <p class="text-gray-300">by ${book.authors}</p>
                    </div>
                </a>
            </div>
        `;
        comRecommendationsContainer.appendChild(bookElement);
    });
};





if (username) {
    const savedRecommendationsKey = `${username}_recommendations`;
    const savedRecommendations = localStorage.getItem(savedRecommendationsKey);
    if (savedRecommendations) {
        const parsedRecommendations = JSON.parse(savedRecommendations);
        if (parsedRecommendations && parsedRecommendations.length > 0) {
            renderComRecs(parsedRecommendations);
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
        // Proceed with generating recommendations
        try {
            //showSparkles();
            const response = await fetch(`/api/recommendations/${username}`);
            const data = await response.json();

            console.log('Recommendations response:', data);

            if (data.success && data.recommendations.length > 0) {
                localStorage.setItem(`${username}_recommendations`, JSON.stringify(data.recommendations));
                renderComRecs(data.recommendations);
            } else {
                console.error('No comedy recommendations found or failed to fetch comedy recommendations:', data.message);
            }
        } catch (error) {
            renderPlaceholderRecommendations();
            console.error('Error fetching recommendations:', error);
        } finally {
            hideSparkles();
            generateButton.classList.remove('racing-glow'); // Remove the racing border animation
            generateButton.classList.add('glow-button');
            generateButton.textContent = 'Generate Recommendations'; // Reset the text


        }
    });
}      else{
renderPlaceholderRecommendations();
}






});