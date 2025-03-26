// Function to send a message to the backend
function sendMessage() {
    const messageInput = document.querySelector('#message-input');
    const message = messageInput.value;
    const userId = 'defaultUser123'; // Static userId

    // Display the user's message in the chat window
    const chatWindow = document.querySelector('#chat-window');
    const userMessage = document.createElement('div');
    userMessage.className = 'user-message';
    userMessage.textContent = `You: ${message}`;
    chatWindow.appendChild(userMessage);

    // Send the message to the backend
    fetch('https://roy-chatbot-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userId, message })
    })
    .then(response => response.json())
    .then(data => {
        // Display ROY's response
        const royMessage = document.createElement('div');
        royMessage.className = 'roy-message';
        royMessage.textContent = `ROY: ${data.response}`;
        chatWindow.appendChild(royMessage);
        messageInput.value = '';
    })
    .catch(error => {
        // Display the error
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = `Error: ${error.message}`;
        chatWindow.appendChild(errorMessage);
    });
}

// Attach the sendMessage function to the Send button
document.querySelector('#send-button').addEventListener('click', sendMessage);
