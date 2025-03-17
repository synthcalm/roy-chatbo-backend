// DOM Elements
const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');

// Function to add a message to the chat
function addMessage(sender, text) {
    const messageClass = sender === 'You' ? 'user' : 'bot';
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', messageClass);
    messageElement.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesDiv.appendChild(messageElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight; // Auto-scroll to bottom
}

// Function to send a message to the server
async function sendMessage() {
    const message = userInput.value.trim();
    if (!message) return;

    // Add user's message to the chat
    addMessage('You', message);

    try {
        // Send message to the backend
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: message })
        });

        // Parse the response
        const data = await response.json();

        // Check for errors in the response
        if (data.error) {
            addMessage('Bot', `Error: ${data.error}`);
        } else {
            addMessage('Bot', data.response || 'Sorry, I could not generate a response.');
        }
    } catch (error) {
        console.error('Error communicating with the server:', error.message);
        addMessage('Bot', 'An error occurred while processing your request.');
    }

    // Clear input field
    userInput.value = '';
}

// Event Listeners
sendButton.addEventListener('click', sendMessage);

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
