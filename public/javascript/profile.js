document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const profileUsername = urlParams.get('username'); // Get the username from the URL
    const loggedInUsername = localStorage.getItem('username'); // Get the logged-in username

    // If no username is specified in the URL, use the logged-in username
    const username = profileUsername || loggedInUsername;
    //editing username
    document.getElementById('editUsernameButton').addEventListener('click', () => {
        document.getElementById('changeUsernameModal').classList.remove('hidden');
      });
      
      document.getElementById('cancelChangeUsername').addEventListener('click', () => {
        document.getElementById('changeUsernameModal').classList.add('hidden');
      });
      
      document.getElementById('changeUsernameForm').addEventListener('submit', async (e) => {
        e.preventDefault();
      
        const newUsername = document.getElementById('newUsernameInput').value;
        const currentUsername = localStorage.getItem('username');
      
        const response = await fetch('/api/auth/change-username', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ oldUsername: currentUsername, newUsername }),
        });
      
        const messageEl = document.getElementById('changeUsernameMessage');
        if (response.ok) {
          messageEl.textContent = 'Username updated successfully';
          messageEl.style.color = 'green';
          document.getElementById('usernameDisplay').textContent = newUsername;
          localStorage.setItem('username', newUsername);
          setTimeout(() => {
            document.getElementById('changeUsernameModal').classList.add('hidden');
          }, 2000);
        } else {
          const error = await response.text();
          messageEl.textContent = error;
          messageEl.style.color = 'red';
        }
      });
      
    if (username) {
        const booksLink = document.getElementById('booksLink');
        booksLink.href = `../html/library.html?username=${username}`;
        document.getElementById('usernameDisplay').textContent = username;
        const friendsLink = document.getElementById('friendsLink');
        friendsLink.href = `../html/friends.html?username=${username}`;
        if (username === loggedInUsername) {
            // Show the logout button and edit button if it's the user's own profile
            document.getElementById('logoutButton').style.display = 'inline-block';
            document.getElementById('editUsernameButton').style.display = 'inline-block';
        } else {
            // Hide both logout and edit buttons if viewing someone else's profile
            document.getElementById('logoutButton').style.display = 'none';
            document.getElementById('editUsernameButton').style.display = 'none';

            // Check and display friendship status
            try {
                const response = await fetch('/api/check-friendship-status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        username: loggedInUsername, 
                        friendUsername: username 
                    }),
                });

                const data = await response.json();

                if (data.success) {
                    const friendStatusSection = document.createElement('div');
                    friendStatusSection.id = 'friendStatusSection';
                    friendStatusSection.className = 'mt-2'; // Add some margin top for spacing

                    // Insert the friend status section after the username display
                    const usernameDisplay = document.getElementById('usernameDisplay');
                    usernameDisplay.parentNode.insertBefore(friendStatusSection, usernameDisplay.nextSibling);

                    if (data.status === 'friend') {
                        friendStatusSection.innerHTML = `
                            <span class="friend-status-badge bg-green-700 text-white py-1 px-2 rounded-full text-sm flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Friends
                            </span>`;
                    } else if (data.status === 'pending') {
                        friendStatusSection.innerHTML = `
                            <span class="friend-status-badge bg-yellow-500 text-white py-1 px-2 rounded-full text-sm flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553 4.553M4 4l16 16" />
                                </svg>
                                Pending
                            </span>`;
                    } else {
                        friendStatusSection.innerHTML = `
                            <button id="addFriendButton" class="friend-status-badge bg-blue-700 text-white py-1 px-2 rounded-full text-sm flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                </svg>
                                Add Friend
                            </button>`;

                        // Add friend button click handler
                        document.getElementById('addFriendButton').addEventListener('click', async () => {
                            try {
                                const addFriendResponse = await fetch('/api/add-friend', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ 
                                        username: loggedInUsername, 
                                        friendUsername: username 
                                    }),
                                });

                                const addFriendData = await addFriendResponse.json();
                                if (addFriendData.success) {
                                    friendStatusSection.innerHTML = `
                                        <span class="friend-status-badge bg-yellow-500 text-white py-1 px-2 rounded-full text-sm flex items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553 4.553M4 4l16 16" />
                                            </svg>
                                            Pending
                                        </span>`;
                                } else {
                                    alert('Failed to send friend request');
                                }
                            } catch (error) {
                                console.error('Error sending friend request:', error);
                                alert('Error sending friend request');
                            }
                        });
                    }
                } else {
                    console.error('Failed to check friendship status:', data.message);
                }
            } catch (error) {
                console.error('Error checking friendship status:', error);
            }
        }

        try {
            const response = await fetch(`/api/number-of-friends/${username}`);
            const data = await response.json();
            if (data.success) {
                document.getElementById('numberOfFriends').textContent = `${data.numberOfFriends}`;
            } else {
                console.error('Failed to fetch number of friends:', data.message);
            }
        } catch (error) {
            console.error('Error fetching number of friends:', error);
        }

        // Fetch library details
        try {
            const response = await fetch(`/api/library/${username}`);
            const data = await response.json();
            if (data.success) {
                document.getElementById('bookCount').textContent = `${data.totalBooks}`;
                document.getElementById('pageCount').textContent = `${data.totalPages}`;
                console.log('Library data:', data);

            } else {
                console.error('Failed to fetch library details:', data.message);
            }

            // Fetch top 5 books
            const top5Response = await fetch(`/api/library/top5/${username}`);
            const top5Data = await top5Response.json();
            const top5Grid = document.getElementById('top5Grid');
            let filledSlots = 0;

            if (top5Data.success) {
                const books = top5Data.top5;
                filledSlots = books.length;

                // Add existing books to top 5 grid
                books.forEach(book => {
                    const bookDiv = document.createElement('div');
                    bookDiv.classList.add('relative', 'p-6', 'rounded-lg', 'shadow-lg', 'cursor-pointer', 'hover:shadow-2xl', 'transition', 'duration-300', 'ease-in-out', 'bg-gray-800');
                    bookDiv.style.width = '200px';  // Set the desired width for the book card
                    bookDiv.style.height = '300px';
                    bookDiv.innerHTML = `
                        <div class="relative group h-full book-card">
                            <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden rounded-lg shadow-lg hover:shadow-2xl transition duration-300 ease-in-out group h-full">
                                <img src="${book.thumbnail}" alt="${book.title}" class="w-full h-full object-cover rounded-t-lg">
                                <div class="absolute bottom-0 left-0 w-full p-4 bg-black bg-opacity-60 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">
                                    <h2 class="text-lg font-bold">${book.title}</h2>
                                    <p class="text-gray-300">by ${book.authors}</p>
                                </div>
                            </a>
                            ${username === loggedInUsername ? `
                                <button onclick="removeFromTop5('${username}', '${book.isbn}')" class="absolute top-0 left-0 mt-2 ml-2 text-xs bg-red-700 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out">Remove</button>
                            ` : ''}
                        </div>
                    `;
                    top5Grid.appendChild(bookDiv);
                });

                // Add empty placeholders for remaining slots
                for (let i = filledSlots; i < 5; i++) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.style.width = '200px';
                    emptyDiv.style.height = '300px';
                    emptyDiv.classList.add('relative', 'p-6', 'rounded-lg', 'shadow-lg', 'bg-gray-800', 'flex', 'items-center', 'justify-center');
                    emptyDiv.innerHTML = `
                        <div class="relative group w-full h-64 flex items-center justify-center">
                            <span class="text-white text-2xl">Empty Book</span>
                        </div>
                    `;
                    top5Grid.appendChild(emptyDiv);
                }
            } else {
                console.error('Failed to fetch top 5 books:', top5Data.message);
                // Add empty placeholders in case of an error
                const top5Grid = document.getElementById('top5Grid');
                for (let i = 0; i < 5; i++) {
                    const emptyDiv = document.createElement('div');
                    emptyDiv.style.width = '200px';
                    emptyDiv.style.height = '300px';
                    emptyDiv.classList.add('relative', 'p-6', 'rounded-lg', 'shadow-lg', 'bg-gray-800', 'flex', 'items-center', 'justify-center');
                    emptyDiv.innerHTML = `
                        <div class="relative group w-full h-64 flex items-center justify-center">
                            <span class="text-white text-2xl">Empty Book</span>
                        </div>
                    `;
                    top5Grid.appendChild(emptyDiv);
                }
            }
        } catch (error) {
            console.error('Error fetching top 5 books:', error);            
        }
    } else {
        window.location.href = '../html/login.html';
    }

    // New function to fetch and display genres
    async function pieChart() {
        try {
            const username = profileUsername || loggedInUsername;
            const response = await fetch(`/api/library/${username}`);
            const data = await response.json();
        
            if (data.success) {
                const categoryCounts = data.categoryCounts;

                // Prep the data for the chart
                const labels = Object.keys(categoryCounts);
                const values = Object.values(categoryCounts);

                const ctx = document.getElementById('categoryChart').getContext('2d');
                new Chart(ctx, {
                    type: 'pie',
                    data: {
                      labels: labels,
                      datasets: [{
                        label: 'Books by Category',
                        data: values,
                        backgroundColor: [
                          '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
                        ]
                      }]
                    },
                    options: {
                      responsive: true,
                      plugins: {
                        legend: {
                          position: 'top',
                          labels: {
                            color: 'white' // Color for legend text
                          }
                        },
                        title: {
                          display: true,
                          text: 'Distribution of Books by Category',
                          color: 'white' // Color for title text
                        }
                      }
                    }
                  });
            } else {
                console.error('Failed to fetch category counts:', data.message);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        }
    }

    // Call the pieChart function
    pieChart();
    async function fetchCurrentlyReading(username) {
        try {
            const response = await fetch(`/api/library/${username}/currently-reading`);
          if (!response.ok) {
                throw new Error('Failed to fetch currently reading books');
          }
          const data = await response.json();
            return data.currentlyReading || [];
        } catch (error) {
            console.error('Error fetching currently reading books:', error);
          return [];
        }
      }
      
    function renderCurrentlyReading(books) {
        const container = document.getElementById('currentlyReadingList');
        if (!container) return;
    
        if (books.length === 0) {
            container.innerHTML = '<p class="text-gray-400">No books currently being read</p>';
            return;
        }
    
        container.innerHTML = books.map(book => {
            const startDate = new Date(book.startDate);
            const endDate = book.endDate ? new Date(book.endDate) : new Date();
            const daysReading = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    
            return `
                <a href="../html/book.html?isbn=${book.isbn}" class="block relative overflow-hidden transition-transform duration-300 ease-in-out group h-full">
                    <div class="flex items-center space-x-4 bg-gray-700 p-3 rounded-lg transform group-hover:scale-105 transition-transform duration-300">
                        <img src="${book.thumbnail}" alt="${book.title}" class="w-16 h-24 object-cover rounded">
                        <div class="flex-1">
                            <h4 class="font-semibold text-sm text-white">${book.title}</h4>
                            <p class="text-gray-400 text-xs">${book.authors}</p>
                            <p class="text-gray-400 text-xs mt-1">Started: ${startDate.toLocaleDateString()}</p>
                            ${book.endDate ? 
                                `<p class="text-green-400 text-xs">Completed: ${new Date(book.endDate).toLocaleDateString()}</p>` :
                                `<p class="text-gray-400 text-xs">Reading for: ${daysReading} days</p>`
                            }
                        </div>
                    </div>
                </a>
            `;
        }).join('');
    }
    const currentlyReadingBooks = await fetchCurrentlyReading(username);
    renderCurrentlyReading(currentlyReadingBooks);
    // Global variables for calendar
    let currentDate = new Date();
    let readingData = [];

    async function fetchReadingData(username) {
        try {
            const response = await fetch(`/api/library/${username}/reading-history`);
            if (!response.ok) {
                throw new Error('Failed to fetch reading history');
            }
            const data = await response.json();
            return data.readingHistory || [];
        } catch (error) {
            console.error('Error fetching reading history:', error);
            return [];
        }
    }

    function generateCalendar(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startingDay = firstDay.getDay();
        const totalDays = lastDay.getDate();
        
        const calendarGrid = document.getElementById('calendarGrid');
        const currentMonthYear = document.getElementById('currentMonthYear');
        
        // Update month/year display
        currentMonthYear.textContent = new Date(year, month).toLocaleDateString('default', { 
            month: 'long', 
            year: 'numeric' 
        });
        
        // Clear existing calendar
        calendarGrid.innerHTML = '';
        
        // Add empty cells for days before the first of the month
        for (let i = 0; i < startingDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'h-12 bg-gray-700 rounded-lg opacity-50';
            calendarGrid.appendChild(emptyCell);
        }
        
        // Add cells for each day
        for (let day = 1; day <= totalDays; day++) {
            const cell = document.createElement('div');
            const currentCellDate = new Date(year, month, day);
            
            // Find books being read on this date
            const booksOnThisDay = readingData.filter(book => {
                const startDate = new Date(book.startDate);
                const endDate = book.endDate ? new Date(book.endDate) : new Date();
                return currentCellDate >= startDate && currentCellDate <= endDate;
            });
            
            cell.className = 'h-12 relative bg-gray-700 rounded-lg transition-all duration-200 hover:bg-gray-600';
            
            // Add day number
            const dayNumber = document.createElement('div');
            dayNumber.className = 'absolute top-1 left-1 text-xs text-gray-400';
            dayNumber.textContent = day;
            cell.appendChild(dayNumber);    
            
            if (booksOnThisDay.length > 0) {
                const bookIndicator = document.createElement('div');
                bookIndicator.className = 'absolute bottom-1 right-1 flex gap-1';
                
                // Create dots for up to 3 books with tooltips
                booksOnThisDay.slice(0, 3).forEach(book => {
                    const dotContainer = document.createElement('div');
                    dotContainer.className = 'relative group';
                    
                    const dot = document.createElement('div');
                    // A book is only completed if it has an endDate
                    const isCompleted = book.endDate !== null && book.endDate !== undefined;
                    const colorClass = isCompleted ? 'bg-green-500' : 'bg-blue-500';
                    dot.className = `w-2 h-2 rounded-full ${colorClass} hover:scale-125 transition-transform duration-200`;
                    
                    // Create tooltip with book cover
                    const tooltip = document.createElement('div');
                    tooltip.className = 'absolute bottom-full right-0 mb-2 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded p-2 shadow-lg z-50';
                    
                    // Calculate reading duration
                    const startDate = new Date(book.startDate);
                    const endDate = book.endDate ? new Date(book.endDate) : new Date();
                    const daysReading = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                    
                    tooltip.innerHTML = `
                        <div class="flex gap-3">
                            <img src="${book.thumbnail}" alt="${book.title}" class="w-16 h-24 object-cover rounded">
                            <div class="flex-1">
                                <div class="text-sm font-semibold mb-1">${book.title}</div>
                                <div class="text-xs text-gray-300">by ${book.authors}</div>
                                <div class="text-xs mt-1">Started: ${startDate.toLocaleDateString()}</div>
                                ${isCompleted ? 
                                    `<div class="text-xs text-green-500">Completed: ${new Date(book.endDate).toLocaleDateString()}</div>` :
                                    `<div class="text-xs text-blue-400"> Currently Reading: ${daysReading} days</div>`
                                }
                            </div>
                        </div>
                    `;
                    
                    // Add arrow to tooltip
                    const arrow = document.createElement('div');
                    arrow.className = 'absolute bottom-0 right-1 transform translate-y-full';
                    arrow.innerHTML = `
                        <svg class="text-gray-900 h-2 w-2" viewBox="0 0 8 4">
                            <path fill="currentColor" d="M4 4L0 0h8L4 4z"/>
                        </svg>
                    `;
                    tooltip.appendChild(arrow);
                    
                    dotContainer.appendChild(dot);
                    dotContainer.appendChild(tooltip);
                    bookIndicator.appendChild(dotContainer);
                });
                
                // If there are more books than shown
                if (booksOnThisDay.length > 3) {
                    const moreIndicator = document.createElement('div');
                    moreIndicator.className = 'relative group';
                    
                    const moreDot = document.createElement('div');
                    moreDot.className = 'w-2 h-2 rounded-full bg-gray-400 hover:scale-125 transition-transform duration-200';
                    
                    const moreTooltip = document.createElement('div');
                    moreTooltip.className = 'absolute bottom-full right-0 mb-2 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded p-2 shadow-lg z-50';
                    
                    // Show all remaining books in the tooltip with thumbnails
                    const remainingBooks = booksOnThisDay.slice(3);
                    moreTooltip.innerHTML = `
                        <div class="text-sm font-semibold mb-2">${remainingBooks.length} more book${remainingBooks.length > 1 ? 's' : ''}:</div>
                        ${remainingBooks.map(book => {
                            const isCompleted = book.endDate !== null && book.endDate !== undefined;
                            return `
                                <div class="flex gap-2 mb-2 pb-2 border-b border-gray-700 last:border-0">
                                    <img src="${book.thumbnail}" alt="${book.title}" class="w-12 h-16 object-cover rounded">
                                    <div class="flex-1">
                                        <div class="font-medium text-xs">${book.title}</div>
                                        <div class="text-gray-300 text-xs">by ${book.authors}</div>
                                        <div class="text-xs ${isCompleted ? 'text-green-500' : 'text-blue-400'}">
                                            ${isCompleted ? 'Completed' : 'Currently Reading'}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    `;
                    
                    const moreArrow = document.createElement('div');
                    moreArrow.className = 'absolute bottom-0 right-1 transform translate-y-full';
                    moreArrow.innerHTML = `
                        <svg class="text-gray-900 h-2 w-2" viewBox="0 0 8 4">
                            <path fill="currentColor" d="M4 4L0 0h8L4 4z"/>
                        </svg>
                    `;
                    moreTooltip.appendChild(moreArrow);
                    
                    moreIndicator.appendChild(moreDot);
                    moreIndicator.appendChild(moreTooltip);
                    bookIndicator.appendChild(moreIndicator);
                }
                
                cell.appendChild(bookIndicator);
            }
            
            calendarGrid.appendChild(cell);
        }
    }

    function initializeCalendar() {
        const prevMonthBtn = document.getElementById('prevMonth');
        const nextMonthBtn = document.getElementById('nextMonth');
        
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            generateCalendar(currentDate.getFullYear(), currentDate.getMonth());
        });
        
        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            generateCalendar(currentDate.getFullYear(), currentDate.getMonth());
        });
        
        // Initial calendar generation
        generateCalendar(currentDate.getFullYear(), currentDate.getMonth());
    }

    // Initialize reading calendar
    readingData = await fetchReadingData(username);
    initializeCalendar();

    const logoutButton = document.getElementById('logoutButton');
    const profilePicInput = document.getElementById('profilePicInput');
    const profileImage = document.getElementById('profileImage');

    // Handle logout
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('username'); // Clear the username from localStorage
        window.location.href = '../html/login.html'; // Redirect to login page
    });

    // Handle profile picture upload
    profilePicInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        const formData = new FormData();
        formData.append('profilePic', file);
        formData.append('username', username);

        try {
            const response = await fetch('/api/upload-profile-pic', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                // Update the profile picture immediately
                profileImage.src = data.imageUrl + '?t=' + new Date().getTime(); // Add timestamp to prevent caching
                alert('Profile picture updated successfully!');
            } else {
                alert('Failed to update profile picture: ' + data.message);
            }
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            alert('Error uploading profile picture. Please try again.');
        }
    });

    // Load user's profile picture if it exists
    async function loadProfilePicture() {
        try {
            const response = await fetch(`/api/profile-pic/${username}`);
            if (response.ok) {
                const data = await response.json();
                if (data.imageUrl) {
                    profileImage.src = data.imageUrl + '?t=' + new Date().getTime();
                }
            }
        } catch (error) {
            console.error('Error loading profile picture:', error);
        }
    }

    // Call this function when the page loads
    await loadProfilePicture();
});



async function removeFromTop5(username, isbn) {
    try {
        const response = await fetch('/api/library/top5/remove', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, isbn }),
        });

        if (response.ok) {
            alert('Book removed from your top 5.');
            window.location.reload();
        } else {
            const error = await response.json();
            alert('Failed to remove book: ' + error.message);
        }
    } catch (error) {
        console.error('Error removing book from top 5:', error);
        alert('Error removing book from top 5.');
    }
}


