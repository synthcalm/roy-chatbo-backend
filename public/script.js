const userNameInput = document.getElementById('user-name');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesDiv = document.getElementById('messages');

sendButton.addEventListener('click', () => {
    const userName = userNameInput.value;
    const message = messageInput.value;
    if (message) {
        // Display the user's message immediately
        messagesDiv.innerHTML += `<p><strong>You:</strong> ${message}</p>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;

        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userName: userName, message: message })
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                messagesDiv.innerHTML += `<p><strong>Error:</strong> ${data.error}</p>`;
            } else {
                messagesDiv.innerHTML += `<p><strong>Bot:</strong> ${data.response}</p>`;
            }
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        })
        .catch(error => {
            console.error('Error:', error);
            messagesDiv.innerHTML += `<p><strong>Error:</strong> Failed to connect to the server.</p>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
        messageInput.value = '';
    }
});