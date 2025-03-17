// In server.js, add the log right after this line:
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');  // This is your current import
// Add the console log right below this line
console.log('Anthropic SDK:', typeof Anthropic, Anthropic?.VERSION || 'unknown');
const bodyParser = require('body-parser');
const path = require('path');

// Load environment variables from .env file
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Anthropic client with error handling
let anthropic;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        anthropic = new Anthropic(process.env.ANTHROPIC_API_KEY);
        console.log('Anthropic client initialized successfully.');
    } catch (error) {
        console.error('Error initializing Anthropic client:', error);
        anthropic = null; // Ensure anthropic is null if initialization fails
    }
} else {
    console.error('ANTHROPIC_API_KEY is not set in environment variables.');
    anthropic = null;
}

// In-memory storage for conversations (replace with a real database in production)
let conversations = {};

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

// Chat endpoint to handle user messages
app.post('/api/chat', async (req, res) => {
    try {
        // Check if Anthropic client is initialized
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

        // Generate a random greeting and replace [Name] with the user's name
        const greeting = greetings[Math.floor(Math.random() * greetings.length)].replace("[Name]", name);

        // Create the system prompt for ROY
        const systemPrompt = createSystemPrompt(name);

        // Call Anthropic API to get ROY's response
        const response = await anthropic.messages.create({
            model: 'claude-3-sonnet-20241022',
            max_tokens: 500,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: greeting + (message ? " " + message : "") }],
        });

        // Extract the bot's response from the API result
        const botResponse = response.content[0].text;
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
    try {
        const { userName, context } = req.body;

        if (!context) {
            return res.status(400).json({ error: 'Context is required for exercise suggestion.' });
        }

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
    try {
        const { userName, message, response } = req.body;

        if (!userName || !message || !response) {
            return res.status(400).json({ error: 'userName, message, and response are required.' });
        }

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