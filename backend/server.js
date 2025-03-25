// Import the tools we need to build the server
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Anthropic = require('@anthropic-ai/sdk');

// Load settings (like secret keys) from a file or Render.com's environment
dotenv.config();

// Create the server
const app = express();

// Allow only specific websites to connect to the backend (CORS setup)
app.use(cors({
    origin: [
        'https://roy-chatbot-backend.onrender.com',
        'https://roy-chatbot.onrender.com',
        'https://synthcalm.com',
        process.env.FRONTEND_URL || 'https://roy-chatbot.onrender.com'
    ].filter(Boolean),
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

// Check if the Anthropic API key is set
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY is missing! Please set it in Render.com environment variables.');
    process.exit(1);
}
console.log('API Key loaded successfully.');

// Set up the Anthropic API client
let anthropic;
try {
    anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });
    console.log('Anthropic client set up successfully.');
} catch (error) {
    console.error('Error setting up Anthropic client:', error.message);
    process.exit(1);
}

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
app.post('/api/chat', async (req, res) => {
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

    // If userId is missing, use a default one for now
    const finalUserId = userId || 'defaultUser123';
    console.log(`Using userId: ${finalUserId}`);

    try {
        // Send the message to the Anthropic API
        const msg = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1000,
            temperature: 0.7,
            system: 'You are ROY, a friendly AI therapist and companion. Respond in a warm, empathetic tone.',
            messages: [
                { role: 'user', content: message }
            ]
        });

        // Get the response text from Anthropic
        const responseText = msg.content && Array.isArray(msg.content) && msg.content[0].text ? msg.content[0].text : "I'm sorry, I couldn't generate a response.";

        res.json({ response: responseText });
    } catch (error) {
        console.error('Error with Anthropic API:', error.message);
        res.status(500).json({
            error: 'I had trouble processing your message. Please try again later.',
            details: error.message
        });
    }
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
