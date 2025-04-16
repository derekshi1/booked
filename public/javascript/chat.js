document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('aiSearchInput');
    const chatContainer = document.getElementById('chatContainer');
    const username = localStorage.getItem('username');
 
 
    if (input) {
      input.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
          const userMessage = input.value.trim();
          if (!userMessage) return;
           appendMessage('user', userMessage);
          input.value = '';
           try {
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: userMessage
               })
            });
             const data = await response.json();
            appendMessage('ai', data.response);
          } catch (err) {
            appendMessage('ai', '⚠️ There was an error processing your request.');
          }
        }
      });
    }
     function appendMessage(sender, text) {
      const bubble = document.createElement('div');
      bubble.classList.add(
        'px-4', 'py-2', 'rounded-lg', 'max-w-xl', 'whitespace-pre-wrap',
        ...(sender === 'user'
          ? ['bg-green-700', 'self-end', 'text-white', 'ml-auto']
          : ['bg-gray-700', 'text-white', 'mr-auto'])
      );
      bubble.textContent = text;
       const wrapper = document.createElement('div');
      wrapper.classList.add('flex', 'flex-col', sender === 'user' ? 'items-end' : 'items-start');
      wrapper.appendChild(bubble);
       chatContainer.appendChild(wrapper);
      chatContainer.scrollTop = chatContainer.scrollHeight; // auto-scroll to bottom
    }
  });
 