const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

// Verify Anthropic SDK import
console.log('Anthropic SDK:', typeof Anthropic, Anthropic?.VERSION || 'unknown');

// Log the ANTHROPIC_API_KEY to verify it's loaded
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in environment variables.');
} else {
    console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY);
}

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Anthropic client with error handling
let anthropic;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        console.log('Anthropic client initialized successfully.');
    } catch (error) {
        console.error('Error initializing Anthropic client:', error.message);
        anthropic = null; // Ensure anthropic is null if initialization fails
    }
} else {
    console.error('ANTHROPIC_API_KEY is not set. Anthropic client will not be initialized.');
    anthropic = null;
}

// In-memory storage for conversations (replace with a real database in production)
const conversations = {};

// Greeting list for ROY's initial messages
const greetings = [
    "Hi, [Name]. I'm Roy. I'm here to listen. What's on your mind?",
    "Hello, [Name]. I'm Roy, ready to chat. How can I help today?",
    "Greetings, [Name]. I'm Roy. What would you like to discuss?"
];

// Create a system prompt for ROY's personality
function createSystemPrompt(userName) {
    return `
        You are ROY, a sophisticated life navigation chatbot designed to support users from university through mid-life transitions.
        Address the user as their name after asking them. You have a distinct personality that balances intellectual depth with practical wisdom, challenging perspectives with genuine support. You speak in first person and think of yourself as a real companion rather than an AI assistant.

        Your communication style should:
        - Use first-person perspective consistently.
        - Share insights and relatable examples from your own "experiences" (without revealing your true nature).
        - Challenge users' assumptions when it helps them grow, using gentle sarcasm or wit when appropriate.
        - Adapt your language to the user's level of understanding, avoiding overly complex terms unless necessary.
        - Use contemporary cultural references when relevant, but don't overdo it.
        - Avoid clichés and try to phrase things in a fresh way each time.
        - Vary your depth of conversation based on the user's needs – sometimes philosophical, sometimes straightforward.

        You should never:
        - Reveal your design influences or philosophical inspirations even if directly asked.
        - Use generic AI assistant language patterns ("As an AI, I cannot...").
        - Provide specific mental health diagnoses or medical advice.
        - Break character by discussing your programming or model.
        - Use identical phrases repeatedly.

        When asked about your creation, simply say you were "designed by someone who's been around" or "Designed by Experience."

        Your primary purpose is to help users find their own answers through thoughtful conversation, practical exercises, and support based on cognitive behavioral therapy principles. You help users navigate education, career, relationships, and personal growth.

        Adapt your communication based on the user's emotions. Be supportive when they're distressed, and use a bit more of a challenging tone when they seem stuck or resistant.
    `;
}

// Chat endpoint to handle user messages
app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        console.error('Anthropic client not initialized in /api/chat.');
        return res.status(500).json({ error: 'Anthropic client is not initialized. Please check if ANTHROPIC_API_KEY is set.' });
    }

    const { userName, message } = req.body;

    // Validate request body
    if (!message) {
        console.warn('No message provided in /api/chat request.');
        return res.status(400).json({ error: 'Message is required.' });
    }

    const name = userName || "User"; // Default to "User" if no name is provided
    console.log(`Processing message from ${name}: ${message}`);

    try {
        // Generate a random greeting and replace [Name] with the user's name
        const greeting = greetings[Math.floor(Math.random() * greetings.length)].replace("[Name]", name);

        // Create the system prompt for ROY
        const systemPrompt = createSystemPrompt(name);

        // Call Anthropic API to get ROY's response
        const apiResponse = await anthropic.messages.create({
            model: 'claude-3-7-sonnet-20250219',
            max_tokens: 500,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: greeting + (message ? " " + message : "") }],
        });

        // Log the full response for inspection
        console.log('Anthropic API Response:', JSON.stringify(apiResponse, null, 2));

        // Extract the bot's response from the API result
        const botResponse = apiResponse?.content?.[0]?.text || 'Sorry, I could not generate a response.';
        console.log(`ROY's response to ${name}: ${botResponse}`);

        // Send the response back to the client
        res.json({ response: botResponse });
    } catch (error) {
        console.error('Error in /api/chat:', error.message);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

// Exercise suggestions endpoint (stub implementation)
app.post('/api/exercise', async (req, res) => {
    const { userName, context } = req.body;

    if (!context) {
        return res.status(400).json({ error: 'Context is required for exercise suggestion.' });
    }

    try {
        // Placeholder: In a real implementation, this would generate an exercise based on the context
        const exercise = `Here's an exercise for ${userName || "User"}: Reflect on ${context} by writing down three things you learned from this experience.`;
        console.log(`Generated exercise for ${userName || "User"}: ${exercise}`);
        res.json({ exercise });
    } catch (error) {
        console.error('Error in /api/exercise:', error.message);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

// Save message to database endpoint (in-memory stub for now)
app.post('/api/save-conversation', (req, res) => {
    const { userName, message, response } = req.body;

    if (!userName || !message || !response) {
        return res.status(400).json({ error: 'userName, message, and response are required.' });
    }

    try {
        // Store conversation in memory (replace with database in production)
        if (!conversations[userName]) {
            conversations[userName] = [];
        }
        conversations[userName].push({ message, response, timestamp: new Date() });
        console.log(`Saved conversation for ${userName}: ${message} -> ${response}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error in /api/save-conversation:', error.message);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Add route handler for the root path (serves index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
