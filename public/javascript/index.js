document.addEventListener('DOMContentLoaded', async () => {
    const username = localStorage.getItem('username');
    if (username) {
      try {
        const response = await fetch(`/api/recommendations/${username}`);
        const data = await response.json();
  
        // Log the entire response for debugging
        console.log('Recommendations response:', data);
            

        if (data.success) {
          const recommendationsGrid = document.getElementById('recommendationsGrid');
  
          // Clear previous recommendations
          recommendationsGrid.innerHTML = '';
  
          data.recommendations.forEach(recommendation => {
            const recommendationElement = document.createElement('div');
            recommendationElement.classList.add('p-4', 'bg-gray-100', 'rounded', 'shadow');
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
            recommendationsGrid.appendChild(recommendationElement);
          });
        } else {
          console.error('Failed to fetch recommendations:', data.message);
        }
      } catch (error) {
        console.error('Error fetching recommendations:', error);
      }
    } else {
      console.log('No username found in localStorage.');
    }
  });
  