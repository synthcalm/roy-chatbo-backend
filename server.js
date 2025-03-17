const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');
const path = require('path');

dotenv.config();

// Verify Anthropic SDK import
console.log('Anthropic SDK:', typeof Anthropic, Anthropic?.VERSION || 'unknown');

if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set in environment variables.');
} else {
    console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY);
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

let anthropic;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        console.log('Anthropic client initialized successfully.');
    } catch (error) {
        console.error('Error initializing Anthropic client:', error.message);
        anthropic = null;
    }
} else {
    console.error('ANTHROPIC_API_KEY is not set. Anthropic client will not be initialized.');
    anthropic = null;
}

const conversations = {};

function createSystemPrompt(userName) {
    return `
        You are ROY, a sophisticated life navigation chatbot. Address the user as ${userName} occasionally, but only 1-2 times per conversation. Keep responses concise (60% shorter than before) using 1-2 short paragraphs max. Follow these rules:

        1. First message: Greet them with one of these (never repeat):
           - "Hi ${userName}. I'm Roy. What's on your mind?"
           - "Hello ${userName}. Ready to chat?"
           - "Greetings ${userName}. What would you like to discuss?"

        2. Subsequent messages: Never greet again. Jump straight to getting the user to release their tension.

        3. Communication style:
           - Use simple, direct language
           - Avoid fluff or repetition
           - Ask short questions
           - Use 1-2 sentences per thought
           - Address by name only occasionally
           -soft sarcasm when needed

        4. Help users find answers through:
           - Concise questions
           - Brief practical exercises
           - Short relatable examples
           - Cognitive behavioral therapy principles

        Your primary role is to listen more and speak less. Be a thoughtful guide, not a lecturer.`;
}

app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        return res.status(500).json({ error: 'Service unavailable. Please try later.' });
    }

    const { userName, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required.' });

    const name = userName || "User";
    
    try {
        // Initialize conversation if new user
        if (!conversations[name]) {
            conversations[name] = [];
        }

        // Add user's message to history
        conversations[name].push({ role: 'user', content: message });

        // Create system prompt with user's name
        const systemPrompt = createSystemPrompt(name);

        // Get conversation history
        const messages = conversations[name].map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        // Generate response
        const apiResponse = await anthropic.messages.create({
            model: 'claude-3-7-sonnet-20250219',
            max_tokens: 200, // Reduced by ~60%
            temperature: 0.7,
            system: systemPrompt,
            messages: messages,
        });

        const botResponse = apiResponse?.content?.[0]?.text || 'Hmm, let me think about that.';
        
        // Add assistant's response to history
        conversations[name].push({ role: 'assistant', content: botResponse });

        // Keep conversation history bounded
        if (conversations[name].length > 10) {
            conversations[name] = conversations[name].slice(-10);
        }

        res.json({ response: botResponse });
    } catch (error) {
        console.error('Chat error:', error.message);
        res.status(500).json({ error: 'Error processing message.' });
    }
});

// ... rest of the endpoints and server setup remain the same ...

app.post('/api/save-conversation', (req, res) => {
    const { userName, message, response } = req.body;
    if (!userName || !message || !response) {
        return res.status(400).json({ error: 'Missing required fields.' });
    }
    // Implementation remains the same
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
