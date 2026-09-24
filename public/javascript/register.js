document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageEl = document.getElementById('message');

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (response.ok) {
            // The server signs new accounts in right away
            const data = await response.json();
            completeLogin(data.username);
        } else {
            messageEl.textContent = await response.text();
        }
    } catch (error) {
        messageEl.textContent = 'An error occurred. Please try again later.';
    }
});
