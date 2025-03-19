const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

console.log('Initializing ROY Chatbot Backend...');
console.log('Node.js Version:', process.version);

// Validate API key
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is missing! Please set it in your environment variables.');
    process.exit(1);
}
console.log('API Key loaded successfully.');

// Initialize Express app
const app = express();

// CORS configuration
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

// Store conversations
const conversations = {};

// Helper Functions
function createSystemPrompt(userId, userData) {
    return `You are ROY, an advanced AI assistant embodying a unique blend of personalities and knowledge.
    User ID: ${userId}.
    [Rest of your system prompt remains unchanged...]`;
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
        temperature: 0.7,
        system: systemPrompt,
        messages: messages
    });
}

function handleError(res, error) {
    console.error('An unexpected error occurred:', error.message);
    res.status(500).json({
        response: "Something went wrong on my end. Let’s try again.",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
}

// API Endpoints
app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        console.error('Anthropic client not initialized.');
        return res.status(503).json({ response: "I’m currently unavailable. Please try again later." });
    }

    const { userId, userName, preferredName, message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
        console.warn('Empty or invalid message received.');
        return res.status(400).json({ response: "I didn't catch that. Could you say something?" });
    }

    try {
        // Initialize new conversation with proper array syntax
        if (!conversations[userId]) {
            conversations[userId] = {
                messages: [],  // Fixed: Added empty array
                userData: {
                    name: userName || 'User',
                    preferredName: preferredName || userName || 'User',
                    isNewUser: true,
                    sessionDuration: 0,
                    emotionalState: 'unknown',
                    topicsDiscussed: [],  // Fixed: Added empty array
                    activeListeningPhase: true
                }
            };
        }

        const userData = conversations[userId].userData;
        const systemPrompt = createSystemPrompt(userId, userData);

        // Add user message to conversation history
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
            // Note: You might need to implement callAnthropicCompletions for older SDK
            throw new Error('Completions API not implemented');
        }

        // Process response
        const processedResponse = processResponse(rawResponse, message);
        conversations[userId].messages.push({ role: 'assistant', content: processedResponse });
        conversations[userId].userData.isNewUser = false;
        conversations[userId].userData.sessionDuration += 1;

        // Emotional state detection
        const depressedTerms = ['depress', 'sad', 'down', 'hopeless', 'worthless', 'tired'];
        const anxiousTerms = ['anx', 'worry', 'stress', 'overwhelm', 'panic'];
        const angryTerms = ['angry', 'upset', 'frustrat', 'mad', 'hate'];
        const positiveTerms = ['better', 'good', 'happy', 'grateful', 'hopeful', 'improve'];

        const lowerCaseMessage = message.toLowerCase();
        if (depressedTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'depressed';
        } else if (anxiousTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'anxious';
        } else if (angryTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'angry';
        } else if (positiveTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'improving';
        }

        // Session stage tracking
        if (conversations[userId].userData.sessionDuration < 5) {
            conversations[userId].userData.activeListeningPhase = true;
        } else if (conversations[userId].userData.sessionDuration >= 5 &&
            conversations[userId].userData.sessionDuration < 15) {
            conversations[userId].userData.activeListeningPhase = false;
        }

        // Topic tracking
        const topicKeywords = {
            'work': ['job', 'career', 'boss', 'workplace', 'coworker'],
            'relationships': ['partner', 'friend', 'family', 'relationship', 'marriage'],
            'health': ['health', 'sick', 'doctor', 'therapy', 'medication'],
            'finance': ['money', 'debt', 'financ', 'bill', 'afford'],
            'self-worth': ['failure', 'worthless', 'useless', 'burden', 'hate myself'],
            'politics': ['war', 'genocide', 'gaza', 'government', 'policy']
        };
        
        if (!conversations[userId].userData.topicsDiscussed) {
            conversations[userId].userData.topicsDiscussed = [];
        }

        Object.keys(topicKeywords).forEach(topic => {
            if (topicKeywords[topic].some(keyword => lowerCaseMessage.includes(keyword))) {
                if (!conversations[userId].userData.topicsDiscussed.includes(topic)) {
                    conversations[userId].userData.topicsDiscussed.push(topic);
                }
            }
        });

        // Response customization
        let tailoredResponse = processedResponse;
        if (conversations[userId].userData.activeListeningPhase) {
            if (conversations[userId].userData.emotionalState === 'depressed') {
                tailoredResponse = `I hear you, ${userData.preferredName}.
                I can sense the weight of your feelings right now, especially with what’s happening in the world.
                You mentioned the situation in Gaza—can you share more about how that’s affecting you? I’m here to listen.`;
            } else {
                tailoredResponse = `I hear you, ${userData.preferredName}.
                It sounds like something is weighing on your mind. Can you tell me more about what’s been going on?
                I’m here for you.`;
            }
        } else if (conversations[userId].userData.emotionalState === 'depressed' &&
            conversations[userId].userData.sessionDuration >= 5) {
            if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = `You’ve brought up the genocide in Gaza,
                ${userData.preferredName}, and I can feel how deeply it’s affecting you—a heavy burden on the heart.
                Do you think this is amplifying your sense of helplessness, or is there another layer to how you’re feeling?
                Let’s explore that together, if you’d like.`;
            } else {
                tailoredResponse = `I’ve noticed you’re feeling down, ${userData.preferredName}.
                Could it be tied to ${conversations[userId].userData.topicsDiscussed.length > 0 ? conversations[userId].userData.topicsDiscussed[0] : 'something specific'}? Let’s explore that together.
                If you’re ready, we could try identifying one small thought to challenge.`;
            }
        } else if (conversations[userId].userData.sessionDuration >= 15) {
            if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = `You’ve shared how the situation in Gaza is weighing on you, ${userData.preferredName}, and that’s a heavy load to carry.
                If it feels right, perhaps you could channel some of that energy into a small action—like learning more from a trusted source or connecting with others who feel the same.
                What do you think?`;
            } else {
                tailoredResponse = `${processedResponse} If it feels right, you might consider a small activity to shift your perspective, like taking a moment to breathe deeply or writing down your thoughts.`;
            }
        }

        res.json({ response: tailoredResponse });
    } catch (error) {
        handleError(res, error);
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
