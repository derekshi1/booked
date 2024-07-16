document.addEventListener('DOMContentLoaded', () => {
    const generateButton = document.getElementById('generateRecommendationsButton');
    const scrollLeftButton = document.getElementById('scrollLeft');
    const scrollRightButton = document.getElementById('scrollRight');
    const recommendationsContainer = document.getElementById('recommendationsContainer');
    const loadingSpinner = document.getElementById('loadingSpinner'); // Ensure this element exists
    
    // Function to render recommendations
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

    const savedRecommendations = localStorage.getItem('recommendations');
    if (savedRecommendations) {
        const parsedRecommendations = JSON.parse(savedRecommendations);
        if (parsedRecommendations && parsedRecommendations.length > 0) {
            renderRecommendations(parsedRecommendations);
        }
    }

    generateButton.addEventListener('click', async () => {
        const username = localStorage.getItem('username');
        if (username) {
            scrollLeftButton.classList.remove('visible');
            scrollRightButton.classList.remove('visible');
            try {
                loadingSpinner.style.display = 'block';
                const response = await fetch(`/api/recommendations/${username}`);
                const data = await response.json();

                // Log the entire response for debugging
                console.log('Recommendations response:', data);

                if (data.success) {
                    // Save recommendations to localStorage
                    localStorage.setItem('recommendations', JSON.stringify(data.recommendations));
                    // Render recommendations
                    renderRecommendations(data.recommendations);
                } else {
                    console.error('Failed to fetch recommendations:', data.message);
                }
            } catch (error) {
                console.error('Error fetching recommendations:', error);
            } finally {
                loadingSpinner.style.display = 'none';
            }
        } else {
            console.log('No username found in localStorage.');
        }
    });
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
});
