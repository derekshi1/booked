document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('aiSearchInput');
    const username = localStorage.getItem('username');

    if (searchInput) {
        console.log('Search input found');
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                console.log('Enter key pressed');
            }
        });
    } else {
        console.error('Search input not found');
    }





})