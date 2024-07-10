document.addEventListener('DOMContentLoaded', async () => {
    const username = localStorage.getItem('username');
    if (username) {
        document.getElementById('usernameDisplay').textContent = username;
        document.getElementById('logoutButton').addEventListener('click', () => {
            localStorage.removeItem('username');
            window.location.href = '../html/index.html';
        });

        // Fetch library details
        try {
            const response = await fetch(`/api/library/${username}`);
            const data = await response.json();
            if (data.success) {
                document.getElementById('bookCount').textContent = `${data.totalBooks}`;
                document.getElementById('pageCount').textContent = `${data.totalPages}`;
            } else {
                console.error('Failed to fetch library details:', data.message);
            }
        } catch (error) {
            console.error('Error fetching library details:', error);
        }
    } else {
        window.location.href = '../html/login.html';
    }
});