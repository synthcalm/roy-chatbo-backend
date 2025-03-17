const userNameInput = document.getElementById('user-name');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesDiv = document.getElementById('messages');

sendButton.addEventListener('click', () => {
    const userName = userNameInput.value;
    const message = messageInput.value;
    if (message) {
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userName: userName, message: message }) // Send userName and message
        })
        .then(response => response.json())
        .then(data => {
            messagesDiv.innerHTML += `<p><strong>Bot:</strong> ${data.response}</p>`;
        });
        messageInput.value = '';
    }
});