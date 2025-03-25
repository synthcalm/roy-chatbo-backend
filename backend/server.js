// Import the tools we need to build the server
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables (like secret keys or settings) from a .env file
dotenv.config();

// Create the server
const app = express();

// Allow the frontend to connect to the backend (CORS setup)
// This lets your website (frontend) talk to this server
app.use(cors({
    origin: [
        'https://roy-chatbot-backend.onrender.com', // Your backend URL
        'https://roy-chatbot.onrender.com',         // Your frontend URL
        process.env.FRONTEND_URL || 'https://roy-chatbot.onrender.com', // Fallback if FRONTEND_URL is not set
        'https://synthcalm.com',                    // Another allowed domain
        'http://localhost:3000'                     // For local testing (remove in production)
    ].filter(Boolean), // Remove any empty values
    methods: ['GET', 'POST'], // Allow these types of requests
    credentials: true // Allow cookies or authentication if needed
}));

// Allow the server to understand JSON data sent from the frontend
app.use(express.json());

// Log when the server starts
console.log('Starting the ROY Chatbot Backend...');
console.log('Node.js Version:', process.version);

// A simple test endpoint to check if the server is running
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(), // How long the server has been running
        timestamp: Date.now()    // Current time
    });
});

// A simple chat endpoint to test communication
// This will respond with a basic message (you can replace this with your Anthropic API logic later)
app.post('/api/chat', (req, res) => {
    const { userId, message } = req.body;

    // Check if the request has the required data
    if (!userId || !message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({
            response: "I need both a user ID and a message to respond."
        });
    }

    // For now, send a simple response (you can add your Anthropic API logic here later)
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

// Handle shutting down the server gracefully (e.g., when Render.com restarts it)
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
