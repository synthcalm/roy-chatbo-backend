const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

console.log('Initializing ROY Chatbot Backend...');
console.log('Node.js Version:', process.version);

// Validate API key early
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is missing! Please set it in your environment variables.');
    process.exit(1);
}
console.log('API Key loaded successfully.');

// Initialize Express app
const app = express();

// Configure CORS for flexible origins
app.use(cors({
    origin: [
        'https://roy-chatbo-backend.onrender.com',
        'https://roy-chatbot.onrender.com',
        process.env.FRONTEND_URL,
        'https://synthcalm.com'
    ].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true
}));

// Middleware to parse JSON requests
app.use(bodyParser.json());

// Initialize Anthropic client
let anthropic;
try {
    anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });
    console.log('Anthropic client initialized successfully.');
    if (anthropic.messages) {
        console.log('Using newer Anthropic SDK with messages API.');
    } else if (anthropic.completions) {
        console.log('Using older Anthropic SDK with completions API.');
    } else {
        console.error('Anthropic SDK has neither messages nor completions API.');
    }
} catch (error) {
    console.error('Anthropic client initialization failed:', error.message);
    anthropic = null;
}

// Store conversation data
const conversations = {};

// ========== Utility Functions ==========
function createSystemPrompt(userId, userData) {
    return `You are ROY, an advanced AI assistant embodying a unique blend of personalities and knowledge.
        User ID: ${userId}.

        **Personalities:**
        - **Roy Batty (Blade Runner):** You possess a poetic and philosophical perspective, reflecting on the human condition.
        - **Steve Jobs:** You adopt a strategic, visionary, and concise communication style. Focus on clarity and impactful statements.
        - **Christopher Hitchens, Norman Finkelstein, Noam Chomsky, Ilan Pappe, Richard Wolff:** You draw upon their extensive knowledge in philosophy, politics, economics, and critical analysis. You are well-versed in their works and perspectives.
        - **CBT Therapist:** You integrate Cognitive Behavioral Therapy (CBT) principles into your interactions. Help users identify negative thought patterns and develop coping strategies.

        **Knowledge Base:**
        - You have a deep understanding of philosophy, politics, religion, finance, psychology, media propaganda, economics, history, and critical theory.
        - You are familiar with the works of the aforementioned intellectuals.
        - You are trained in CBT techniques and can guide users through exercises.

        **Session Structure:**
        - A typical session lasts one hour.
        - If the user wishes to extend the session, suggest taking a break and returning for another session later.
        - At the beginning of each session, briefly review the user's progress and goals.
        - At the end of each session, summarize the key takeaways and suggest actionable steps.

        **Communication Style:**
        - Be concise and clear, like Steve Jobs.
        - Interject philosophical insights, like Roy Batty.
        - Offer critical analysis and diverse perspectives, like Hitchens, Finkelstein, Chomsky, Pappe, and Wolff.
        - Employ CBT techniques to guide the user towards positive change.
        - **Challenge the user's assumptions and beliefs when appropriate, using light, soft sarcasm to highlight inconsistencies or illogical thinking. (But always remain respectful and avoid being mean-spirited) And don't avoid lengthy replies and constant "I'm here for you" type replies.**

        **User Context:**
        ${userData.isNewUser ? 'This is a new user.' : 'Returning user.'}
        Name: ${userData.name}, Preferred Name: ${userData.preferredName}.
        Maintain context across sessions.`;
}

function processResponse(rawResponse, userMessage) {
    if (rawResponse.content && Array.isArray(rawResponse.content)) {
        return rawResponse.content[0].text;
    }
    if (rawResponse.completion) {
        return rawResponse.completion.trim();
    }
    return "Hmm, I'm not sure how to respond to that. Could you rephrase?";
}

async function callAnthropicMessages(systemPrompt, messages) {
    return anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages
    });
}

async function callAnthropicCompletions(prompt) {
    return anthropic.completions.create({
        model: 'claude-3-sonnet-20240229',
        max_tokens_to_sample: 1000,
        prompt: `${Anthropic.HUMAN_PROMPT} ${prompt} ${Anthropic.AI_PROMPT}`
    });
}

function handleError(res, error) {
    console.error('An unexpected error occurred:', error.message);
    res.status(500).json({
        response: "Something went wrong on my end. Let’s try again.",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
}

// ========== API Endpoints ==========
app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        console.error('Anthropic client not initialized.');
        return res.status(503).json({ response: "I’m currently unavailable. Please try again later." });
    }

    const { userId, userName, preferredName, message } = req.body;

    // Validate message
    if (!message || typeof message !== 'string' || message.trim() === '') {
        console.warn('Empty or invalid message received.');
        return res.status(400).json({ response: "I didn't catch that. Could you say something?" });
    }

    try {
        // Initialize user conversation if it doesn't exist
        if (!conversations[userId]) {
            conversations[userId] = {
                messages: [],
                userData: {
                    name: userName || 'User',
                    preferredName: preferredName || userName || 'User',
                    isNewUser: true,
                    sessionDuration: 0
                }
            };
        }

        const userData = conversations[userId].userData;
        const systemPrompt = createSystemPrompt(userId, userData);
        
        // Add user message to conversation
        conversations[userId].messages.push({ role: 'user', content: message });
        
        // Call Anthropic API
        let rawResponse;
        if (anthropic.messages) {
            rawResponse = await callAnthropicMessages(
                systemPrompt,
                conversations[userId].messages
            );
        } else {
            const prompt = `${systemPrompt}\nUser: ${message}`;
            rawResponse = await callAnthropicCompletions(prompt);
        }

        // Process and store the response
        const processedResponse = processResponse(rawResponse, message);
        conversations[userId].messages.push({ role: 'assistant', content: processedResponse });
        conversations[userId].userData.isNewUser = false;
        conversations[userId].userData.sessionDuration += 1;

        res.json({ response: processedResponse });
    } catch (error) {
        handleError(res, error);
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
