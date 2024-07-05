document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    const userSection = document.getElementById('userSection');
    userSection.innerHTML = `
        <div class="search-container">
            <img src="https://cdn-icons-png.flaticon.com/512/54/54481.png" alt="Search" class="search-icon w-6 h-6" onclick="expandSearch()">
            <input type="text" id="titleInput" placeholder="Search for books" class="search-input" onblur="collapseSearch()" onkeydown="handleSearch(event)">
            <img src="https://cdn-icons-png.flaticon.com/512/1828/1828778.png" alt="Close" class="close-icon w-6 h-6" onclick="collapseSearch()">
        </div>
        <a href="../html/library.html" class="ml-4 bg-green-900 text-white px-4 py-2 rounded">Library</a>
    `;

    if (username) {
        userSection.innerHTML += `
            <div class="flex flex-col items-center">
                <img src="../profile.png" alt="Profile" class="w-6 h-6 mb-1 cursor-pointer" onclick="window.location.href='../html/profile.html'">
                <span class="handwriting-font cursor-pointer" onclick="window.location.href='../html/profile.html'">${username}</span>
            </div>
        `;
    } else {
        userSection.innerHTML += `
            <a href="../html/login.html" class="ml-4 bg-green-900 text-white px-4 py-2 rounded">Login</a>
        `;
    }
});
