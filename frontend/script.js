// DOM Elements
const messagesDiv = document.getElementById('messages'); // Messages container
const userInput = document.getElementById('user-input'); // User input field
const sendButton = document.getElementById('send-button'); // Send button

// Add event listener to the send button
sendButton.addEventListener('click', () => {
    const message = userInput.value.trim(); // Get the user's message and trim whitespace

    if (message) {
        // Send the message to the server via a POST request
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message: message }) // Send only the message (no userName)
        })
        .then(response => response.json()) // Parse the response as JSON
        .then(data => {
            // Append the bot's response to the messages container
            messagesDiv.innerHTML += `<p><strong>Bot:</strong> ${data.response}</p>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight; // Auto-scroll to the bottom
        })
        .catch(error => {
            console.error('Error communicating with the server:', error);
            messagesDiv.innerHTML += `<p><strong>Error:</strong> An error occurred while processing your request.</p>`;
        });

        // Clear the input field after sending the message
        userInput.value = '';
    }
});