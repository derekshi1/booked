document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    const userSection = document.getElementById('userSection');
    if (username) {
        userSection.innerHTML = `
            <span class="text-green-900 handwriting-font">${username}</span>
            <button id="logoutButton" class="ml-4 text-white bg-red-700 px-4 py-2 rounded">Logout</button>
        `;
        
        document.getElementById('logoutButton').addEventListener('click', () => {
            localStorage.removeItem('username');
            window.location.href = '../html/index.html';
        });
    }
});


document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
    });

   
    const messageEl = document.getElementById('message');
    if (response.ok) {
        alert('Registration successful');
        window.location.href = '../html/login.html';
    } else {
        const error = await response.text();
        messageEl.textContent = error;
    }
    });
    