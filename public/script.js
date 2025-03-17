const userNameInput = document.getElementById('user-name'); // Get the user name input
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesDiv = document.getElementById('messages');

let uid = localStorage.getItem('uid'); // Get user ID from local storage

if (!uid) {
    uid = generateUUID(); // Generate a new UUID if it doesn't exist
    localStorage.setItem('uid', uid); // Store the UUID in local storage
}

sendButton.addEventListener('click', () => {
    const userName = userNameInput.value; // Get the user's name
    const message = messageInput.value;
    if (message) {
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uid: uid, userName: userName, message: message }) // Send uid, userName, and message
        })
        .then(response => response.json())
        .then(data => {
            messagesDiv.innerHTML += `<p><strong>Bot:</strong> ${data.response}</p>`;
        });
        messageInput.value = '';
    }
});

function generateUUID() {
    // Generate a UUID (Version 4)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}