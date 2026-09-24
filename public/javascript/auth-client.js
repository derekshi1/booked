// Shared sign-in helpers for login.html and register.html
const GOOGLE_CLIENT_ID = '14363939556-rfd3scpioaorp8a4tj65on03hblb5rs9.apps.googleusercontent.com';

// The server session (an httpOnly cookie) is the source of truth; localStorage
// keeps the username for the pages that read it
function completeLogin(username) {
    localStorage.setItem('username', username);
    sessionStorage.removeItem('guest');
    window.location.href = '../html/index.html';
}

function continueAsGuest() {
    localStorage.removeItem('username');
    sessionStorage.setItem('guest', 'true');
    window.location.href = '../html/index.html';
}

// Already signed in? Skip the login/register page.
async function redirectIfSignedIn() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const { username } = await response.json();
            completeLogin(username);
        }
    } catch (error) {
        console.error('Error checking session:', error);
    }
}

async function sendGoogleToken(accessToken, username) {
    const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, username }),
    });
    if (response.ok) {
        const data = await response.json();
        completeLogin(data.username);
        return { done: true };
    }
    if (response.status === 404) return { needsUsername: true };
    return { error: await response.text() };
}

// Opens Google's popup, then signs in. New Google accounts are asked to pick a
// username in the #googleUsernameForm field before the account is created.
function setUpGoogleSignIn({ buttonId, formId, inputId, messageId }) {
    const message = document.getElementById(messageId);
    const usernameInput = document.getElementById(inputId);
    let accessToken = null;

    usernameInput.addEventListener('keydown', async (event) => {
        if (event.key !== 'Enter' || !accessToken) return;
        event.preventDefault();
        const result = await sendGoogleToken(accessToken, usernameInput.value.trim());
        if (result.error) message.textContent = result.error;
    });

    document.getElementById(buttonId).addEventListener('click', (e) => {
        e.preventDefault();
        message.textContent = '';
        try {
            const client = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: 'openid email profile',
                callback: async (response) => {
                    if (!response.access_token) {
                        message.textContent = 'Google sign-in was cancelled';
                        return;
                    }
                    accessToken = response.access_token;
                    const result = await sendGoogleToken(accessToken);
                    if (result.needsUsername) {
                        document.getElementById(formId).classList.remove('hidden');
                        message.textContent = 'Pick a username for your new account, then press Enter';
                        usernameInput.focus();
                    } else if (result.error) {
                        message.textContent = result.error;
                    }
                },
            });
            client.requestAccessToken();
        } catch (error) {
            console.error('Google Sign-In error:', error);
            message.textContent = 'An error occurred with Google Sign-In';
        }
    });
}
