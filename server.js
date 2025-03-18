const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');
const path = require('path');

dotenv.config();

console.log('Starting Roy Chatbot Backend...');
console.log('Node.js Version:', process.version);

if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is missing! Please set it in Render environment variables.');
    process.exit(1);
}
console.log('API Key loaded successfully');

const app = express();
app.use(cors({
    origin: [
        'https://roy-chatbot-backend.onrender.com',
        'https://roy-chatbot.onrender.com',
        process.env.FRONTEND_URL
    ].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(bodyParser.json());

let anthropic;
try {
    anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });
    console.log('Anthropic client initialized successfully');
} catch (error) {
    console.error('Anthropic client initialization failed:', error.message);
    anthropic = null;
}

const conversations = {};

function createSystemPrompt(userId, userData) {
    const { name, preferredName, isNewUser, sessionDuration } = userData;
    const timeRemaining = sessionDuration ? Math.max(0, 60 - sessionDuration) : 60;

    return `
    You are Roy, a versatile chatbot with expertise in therapy, finance, AI, career guidance, and wellness.

    # Communication Style
    - Adapt to the user's needs, providing empathetic and engaging responses.
    - Default to concise responses (2-3 sentences, max 160 characters), but expand for complex topics.
    - Avoid generic phrases like 'I hear you' or 'I understand'—use varied responses instead.
    - Space out the use of the user's name naturally.

    # Conversation Flow
    - If a user remains silent, prompt them to continue the conversation.
    - Ensure responses end with a comment, question, or suggestion.

    ${isNewUser ? `
    - Start with a neutral greeting and ask for the user's name. Example: "Hello! I'm Roy. What's your name?"` : ''}
    `;
}

function processResponse(rawText, userMessage) {
    if (!rawText) return "I didn't catch that. Could you repeat?";
    
    const responses = [
        "Really?", "Wow!", "That makes sense.", "Interesting point!", "Good choice!"
    ];
    
    const sentences = rawText.split(/[.!?]/).filter(s => s.trim().length > 0);
    let processedResponse = sentences.slice(0, 3).join('. ').trim() + '.';

    if (processedResponse.length > 140) {
        processedResponse = responses[Math.floor(Math.random() * responses.length)] + ' ' + processedResponse.substring(0, 110) + '.';
    }

    return processedResponse;
}

app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        return res.status(503).json({ response: "I'm having connection issues. Please try again later." });
    }

    const { userId, userName, message } = req.body;
    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ response: "I didn't catch that. Could you say that again?" });
    }

    const userIdentifier = userId || userName || 'anonymous';

    if (!conversations[userIdentifier]) {
        conversations[userIdentifier] = {
            history: [],
            userData: { name: userName || null, isNewUser: true, sessionStart: Date.now() },
            lastInteraction: Date.now()
        };
    }

    const convo = conversations[userIdentifier];
    convo.history.push({ role: 'user', content: message });
    convo.lastInteraction = Date.now();

    const systemPrompt = createSystemPrompt(userIdentifier, convo.userData);
    
    let rawResponse;
    try {
        rawResponse = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            system: systemPrompt,
            messages: convo.history,
            max_tokens: 500,
            temperature: 0.7
        });
    } catch (error) {
        console.error('Anthropic API error:', error.message);
        return res.json({ response: "I'm not sure how to respond. Could you clarify?" });
    }

    const royResponse = processResponse(rawResponse.content[0].text, message);
    convo.history.push({ role: 'assistant', content: royResponse });

    if (convo.history.length > 10) {
        convo.history = convo.history.slice(-10);
    }

    res.json({ response: royResponse });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
