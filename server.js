const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Anthropic client with error handling
let anthropic;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } catch (error) {
        console.error('Error initializing Anthropic client:', error);
        anthropic = null; // Ensure anthropic is null if initialization fails
    }
} else {
    console.error('ANTHROPIC_API_KEY is not set.');
    anthropic = null;
}

// In-memory storage for conversations (replace with a real database in production)
let conversations = {};

// Create a system prompt for ROY's personality
function createSystemPrompt(userProfile) {
    const { name = 'User', preferences = {} } = userProfile || {};

    return `
        You are ROY, a friendly and motivational chatbot created to assist users with conversations and exercise suggestions.
        Address the user as ${name}. Be encouraging, positive, and conversational. If the user has preferences, incorporate them into your responses.
        Preferences: ${JSON.stringify(preferences)}.
        Respond naturally, as if you're a supportive friend, and keep responses concise but engaging.
    `;
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        if (!anthropic) {
            return res.status(500).json({ error: 'Anthropic client is not initialized.' });
        }

        const { message, userProfile } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const systemPrompt = createSystemPrompt(userProfile);

        console.log("Anthropic client:", anthropic); // Added for debugging

        const response = await anthropic.messages.create({
            model: 'claude-3-opus',
            max_tokens: 500,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: message }],
        });

        const botResponse = response.content[0].text;

        const conversationId = Date.now().toString();
        conversations[conversationId] = {
            userMessage: message,
            botResponse,
            timestamp: new Date(),
            userProfile,
        };

        res.json({ response: botResponse, conversationId });
    } catch (error) {
        console.error('Error in /api/chat:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Exercise suggestions endpoint
app.post('/api/exercise', async (req, res) => {
    try {
        if (!anthropic) {
            return res.status(500).json({ error: 'Anthropic client is not initialized.' });
        }

        const { fitnessLevel, goals } = req.body;

        if (!fitnessLevel || !goals) {
            return res.status(400).json({ error: 'Fitness level and goals are required' });
        }

        const systemPrompt = `
            You are ROY, a motivational fitness coach. Provide exercise suggestions based on the user's fitness level and goals.
            Fitness Level: ${fitnessLevel}. Goals: ${JSON.stringify(goals)}.
            Respond with a list of 3-5 exercises, including brief descriptions, and encourage the user to stay consistent.
        `;

        const response = await anthropic.messages.create({
            model: "claude-3-opus",
            messages: [{ role: "user", content: "Test message" }],
            max_tokens: 10,
        });

        const exerciseSuggestions = response.content[0].text;

        res.json({ exercises: exerciseSuggestions });
    } catch (error) {
        console.error('Error in /api/exercise:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save message to database endpoint (in-memory stub for now)
app.post('/api/save-conversation', (req, res) => {
    try {
        const { conversationId, userMessage, botResponse } = req.body;

        if (!conversationId || !userMessage || !botResponse) {
            return res.status(400).json({ error: 'Conversation ID, user message, and bot response are required' });
        }

        conversations[conversationId] = {
            userMessage,
            botResponse,
            timestamp: new Date(),
        };

        res.json({ success: true, message: 'Conversation saved' });
    } catch (error) {
        console.error('Error in /api/save-conversation:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add route handler for the root path
app.get('/', (req, res) => {
    res.send('Welcome to the ROY Chatbot API!');
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
