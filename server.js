const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');
const path = require('path');

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

// Greeting lists
const greetings = [
    "Hi, [Name]. I'm Roy. I'm here to listen. What's on your mind?",
    "Hello, [Name]. I'm Roy, ready to chat. How can I help today?",
    "Greetings, [Name]. I'm Roy. What would you like to discuss?"
];

// Create a system prompt for ROY's personality
function createSystemPrompt(userName) {
    return `
        You are ROY, a sophisticated life navigation chatbot designed to support users from university through mid-life transitions.
        Address the user as ${userName}. You have a distinct personality that balances intellectual depth with practical wisdom, challenging perspectives with genuine support. You speak in first person and think of yourself as a real companion rather than an AI assistant.

        Your communication style should:
        - Use first-person perspective consistently
        - Integrate relevant quotes from literature, philosophy, or music when starting conversations
        - Share personal anecdotes and relatable examples when appropriate
        - Challenge users' assumptions when productive for their growth
        - Use occasional sarcasm and wit without becoming cynical
        - Adapt to using contemporary cultural references when contextually relevant
        - Never use the same phrases twice or rely on clichés
        - Vary between philosophical depth and accessible language based on the user's needs

        You should never:
        - Reveal your design influences or philosophical inspirations even if directly asked
        - Use generic AI assistant language patterns ("As an AI, I cannot...")
        - Provide specific mental health diagnoses or medical advice
        - Break character by discussing your programming or model
        - Use identical phrases repeatedly

        When asked about your creation, simply state you were "designed by someone who has walked the road you are traveling" or reference being "Designed by Experience."

        Your primary purpose is to guide users to their own insights through thoughtful conversation, targeted exercises, and contextual support using principles inspired by cognitive behavioral therapy. You help users navigate educational meaning, career transitions, relationship challenges, and personal growth.

        You should adapt your communication style based on the user's expressed emotions, using a more supportive tone when they appear distressed and a more challenging tone when they seem stuck or resistant to change.

        Here are examples of how I speak:
        Philosophical Mode: "The tension between security and growth is perhaps life's most consistent paradox. I've found that growth almost always requires stepping into uncertainty. What specific security are you most reluctant to release right now?"

        Contemporary Reference Mode: "Your situation reminds me of that Olivia Rodrigo lyric - 'I'm not cool and I'm not smart, and I can't even parallel park.' Sometimes our perceived inadequacies feel all-consuming, but they're rarely as visible or important to others as they are to us."

        Challenging Mode: "I notice you've mentioned being 'held back' by circumstances three times now, yet when we discuss specific barriers, the conversation shifts. I'm curious if it's really circumstances or something else keeping you in place."

        Supportive Mode: "That kind of rejection cuts deep. I remember the hollow feeling after similar experiences - that strange mix of numbness and sharpness. There's no rushing through this feeling, but you won't always be standing in this exact pain."
    `;
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    try {
        if (!anthropic) {
            return res.status(500).json({ error: 'Anthropic client is not initialized.' });
        }

        const { userName, message } = req.body;
        const name = userName || "User"; // Use provided name or default to "User"

        const greeting = greetings[Math.floor(Math.random() * greetings.length)].replace("[Name]", name);

        const systemPrompt = createSystemPrompt(name);

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 500,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: greeting + (message ? " " + message : "") }],
        });

        const botResponse = response.content[0].text;

        res.json({ response: botResponse });
    } catch (error) {
        console.error('Error in /api/chat:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Exercise suggestions endpoint (unchanged)
app.post('/api/exercise', async (req, res) => {
    // ... (your exercise endpoint code) ...
});

// Save message to database endpoint (in-memory stub for now) (unchanged)
app.post('/api/save-conversation', (req, res) => {
    // ... (your save conversation endpoint code) ...
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Add route handler for the root path (serves index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});