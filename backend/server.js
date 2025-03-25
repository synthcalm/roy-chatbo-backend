// Import the tools we need to build the server
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load settings (like secret keys) from a file or Render.com's environment
dotenv.config();

// Create the server
const app = express();

// Allow the frontend to connect to the backend (CORS setup)
// For now, allow all websites to connect (we'll make this more secure later)
app.use(cors({
    origin: (origin, callback) => {
        console.log(`Checking if this website can connect: ${origin}`);
        callback(null, true); // Allow all websites for testing
    },
    methods: ['GET', 'POST'],
    credentials: true
}));

// Allow the server to understand messages sent from the frontend
app.use(express.json());

// Log every request the server receives to help with troubleshooting
app.use((req, res, next) => {
    console.log(`Got a ${req.method} request to ${req.url} from ${req.headers.origin}`);
    next();
});

// Log when the server starts
console.log('Starting the ROY Chatbot Backend...');
console.log('Node.js Version:', process.version);

// A simple test endpoint to check if the server is working
app.get('/api/test', (req, res) => {
    console.log('Someone accessed the test endpoint');
    res.json({ message: 'The server is working! You can connect to me.' });
});

// A health check endpoint to see if the server is running
app.get('/api/health', (req, res) => {
    console.log('Someone checked if the server is healthy');
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

// The main chat endpoint where the frontend sends messages
app.post('/api/chat', (req, res) => {
    const { userId, message } = req.body;

    console.log('Chat endpoint accessed with this data:', req.body);

    // Check if the message is missing or empty
    if (!message || typeof message !== 'string' || message.trim() === '') {
        console.log('Error: The message is missing or empty');
        return res.status(400).json({
            error: 'I need a message to respond to. Please send a non-empty message.',
            details: {
                userId: userId ? 'Provided' : 'Missing',
                message: 'Missing or empty'
            }
        });
    }

    // If userId is missing, use a default one for testing
    const finalUserId = userId || 'defaultUser123';
    console.log(`Using userId: ${finalUserId}`);

    // Send a simple response
    const response = `Hello! I received your message: "${message}". I'm ROY, nice to meet you!`;
    res.json({ response });
});

// Start the server on the port Render.com gives us (or 3000 if testing on your computer)
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`ROY is listening on port ${PORT}`);
    console.log(`Server started at ${new Date().toISOString()}`);
});

// If the server fails to start, log the problem
server.on('error', (error) => {
    console.error('The server could not start:', error.message);
    process.exit(1);
});

// When Render.com stops the server, close it nicely
process.on('SIGTERM', () => {
    console.log('Render.com is stopping the server. Closing nicely...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
