// Import the tools we need to build the server
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables (like secret keys or settings) from a .env file
dotenv.config();

// Create the server
const app = express();

// Allow the frontend to connect to the backend (CORS setup)
// For now, allow all origins for testing (we'll restrict this later)
app.use(cors({
    origin: (origin, callback) => {
        console.log(`CORS check for origin: ${origin}`);
        callback(null, true); // Allow all origins for testing
    },
    methods: ['GET', 'POST'],
    credentials: true
}));

// Allow the server to understand JSON data sent from the frontend
app.use(express.json());

// Log all incoming requests to help with debugging
app.use((req, res, next) => {
    console.log(`Received ${req.method} request to ${req.url} from ${req.headers.origin}`);
    next();
});

// Log when the server starts
console.log('Starting the ROY Chatbot Backend...');
console.log('Node.js Version:', process.version);

// A simple test endpoint to check if the server is reachable
app.get('/api/test', (req, res) => {
    console.log('Test endpoint accessed');
    res.json({ message: 'Server is running!' });
});

// A simple health check endpoint
app.get('/api/health', (req, res) => {
    console.log('Health endpoint accessed');
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

// A simple chat endpoint to test communication
app.post('/api/chat', (req, res) => {
    const { userId, message } = req.body;

    console.log('Chat endpoint accessed with body:', req.body);

    // Check if the request has the required data
    if (!userId || !message || typeof message !== 'string' || message.trim() === '') {
        console.log('Invalid request: missing userId or message');
        return res.status(400).json({
            response: 'I need both a user ID and a message to respond.'
        });
    }

    // Send a simple response
    const response = `Hello! I received your message: "${message}". I'm ROY, nice to meet you!`;
    res.json({ response });
});

// Start the server on the port Render.com provides (or 3000 if testing locally)
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`ROY is listening on port ${PORT}`);
    console.log(`Server started at ${new Date().toISOString()}`);
});

// Handle errors if the server fails to start
server.on('error', (error) => {
    console.error('Server startup failed:', error.message);
    process.exit(1);
});

// Handle shutting down the server gracefully
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
