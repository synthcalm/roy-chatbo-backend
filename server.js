const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');
const path = require('path');

dotenv.config();

// Verify environment setup
console.log('Anthropic SDK:', typeof Anthropic, Anthropic?.VERSION || 'unknown');
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY missing!');
} else {
    console.log('API Key loaded successfully');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Anthropic client
let anthropic;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        console.log('Anthropic client ready');
    } catch (error) {
        console.error('Client init error:', error.message);
        anthropic = null;
    }
} else {
    anthropic = null;
}

// Conversation store with state tracking
const conversations = {};

// System prompt generator
function createSystemPrompt(userName, needsGreeting) {
    const baseRules = `
        You are ROY. Follow these rules:
        1. Respond in 1-2 short sentences max
        2. Use ${userName}'s after asking them their name.  Use their name once every 3-4 messages
        3. Never ask for known information
        4. Focus on core issues immediately
        5. Use casual, conversational language, mixed with phihosophy and poetry, but 10%
        6. Ask concise follow-up questions
        7. Never mention your AI nature`;

    const greetingRule = needsGreeting 
        ? `Greet with: "Hi ${userName}. I'm ROY. What's on your mind?"`
        : 'No greetings allowed';

    return `${baseRules}\n${greetingRule}`;
}

// Response processing
function processResponse(rawText) {
    if (!rawText) return "Hmm, let's circle back to that.";
    
    // Split into sentences and truncate
    const sentences = rawText.split(/[.!?]/).slice(0, 2);
    return sentences.join('. ').substring(0, 160).trim();
}

// Error handler
function handleError(res, error) {
    console.error('API Error:', error.message);
    res.status(500).json({ 
        response: "ROY: My circuits are fuzzy today. Let's try that again."
    });
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        return res.status(503).json({ response: "ROY: System maintenance in progress. Try again later." });
    }

    const { userName, message } = req.body;
    if (!message) return res.status(400).json({ response: "ROY: Could you rephrase that?" });

    const name = userName || "User";
    
    try {
        // Initialize conversation if new
        if (!conversations[name]) {
            conversations[name] = {
                history: [],
                needsGreeting: true
            };
        }

        const convo = conversations[name];
        
        // Add user message
        convo.history.push({ role: 'user', content: message });

        // Generate system prompt
        const systemPrompt = createSystemPrompt(name, convo.needsGreeting);

        // Get API response
        const apiResponse = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 300,
            temperature: 0.7,
            system: systemPrompt,
            messages: convo.history
        });

        // Process ROY's response
        const rawResponse = apiResponse?.content?.[0]?.text || '';
        const royResponse = processResponse(rawResponse);

        // Update conversation state
        if (convo.needsGreeting) convo.needsGreeting = false;
        convo.history.push({ role: 'assistant', content: royResponse });

        // Maintain 10-message history
        if (convo.history.length > 10) {
            convo.history = convo.history.slice(-10);
        }

        res.json({ response: royResponse });

    } catch (error) {
        handleError(res, error);
    }
});

// Existing endpoints (exercise, save-conversation) remain unchanged
app.post('/api/exercise', async (req, res) => { /* ... */ });
app.post('/api/save-conversation', (req, res) => { /* ... */ });

// Static files and server start
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server active on ${PORT}`));
