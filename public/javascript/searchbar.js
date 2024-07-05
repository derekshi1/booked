// Search bar functionality
function expandSearch() {
    const searchInput = document.getElementById('titleInput');
    const closeIcon = document.querySelector('.close-icon');
    searchInput.classList.add('expanded');
    closeIcon.classList.add('visible');
    searchInput.focus();
 }
 
 function collapseSearch() {
    const searchInput = document.getElementById('titleInput');
    const closeIcon = document.querySelector('.close-icon');
    searchInput.classList.remove('expanded');
    closeIcon.classList.remove('visible');
    searchInput.value = '';  // Clear the input field
 }
 
 function handleSearch(event) {
    if (event.key === 'Enter') {
        searchBookByTitle();
        event.preventDefault();
    }
 }
 
 // Search functionality
 function searchBookByTitle() {
    var title = document.getElementById('titleInput').value;
    window.location.href = `searched.html?query=${title}`;
 }
 
 // Modal handling
 function loadBook(isbn) {
    if (isbn) {
        initialize(isbn);
        document.getElementById('myModal').classList.remove('hidden');
        document.getElementById('myModal').classList.add('flex');
    } else {
        alert('ISBN not found.');
    }
 }
 
 function closeModal() {
    document.getElementById('myModal').classList.add('hidden');
    document.getElementById('myModal').classList.remove('flex');
 }
 
 window.onclick = function(event) {
    var modal = document.getElementById('myModal');
    if (event.target == modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
 }
 
 