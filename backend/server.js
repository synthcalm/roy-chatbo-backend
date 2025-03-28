require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Anthropic } = require('@anthropic-ai/sdk');

// Core server configuration
const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_START_TIME = Date.now();

// Validate critical environment variables
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('FATAL: ANTHROPIC_API_KEY is missing');
    process.exit(1);
}

// Middleware setup
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    credentials: true
}));
app.use(bodyParser.json());

// Anthropic Client Initialization
let anthropicClient;
try {
    anthropicClient = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });
    console.log('Anthropic client successfully initialized');
} catch (error) {
    console.error('Failed to initialize Anthropic client:', error);
    process.exit(1);
}

// In-memory conversation storage
const conversations = {};
const CONVERSATION_TIMEOUT = 60 * 60 * 1000; // 1 hour

// Memory Management: Clear inactive conversations
setInterval(() => {
    const now = Date.now();
    Object.keys(conversations).forEach(userId => {
        if (now - conversations[userId].lastActiveTimestamp > CONVERSATION_TIMEOUT) {
            delete conversations[userId];
        }
    });
}, 15 * 60 * 1000); // Run every 15 minutes

// Utility Functions
function analyzeUserMessage(message) {
    const emotionalStates = {
        depressed: ['sad', 'down', 'hopeless', 'tired', 'exhausted'],
        anxious: ['worried', 'nervous', 'stressed', 'panic', 'afraid'],
        angry: ['mad', 'frustrated', 'furious', 'rage', 'upset'],
        philosophical: ['meaning', 'purpose', 'existence', 'life', 'philosophy'],
        positive: ['happy', 'joy', 'excited', 'grateful', 'optimistic']
    };

    const topicKeywords = {
        work: ['job', 'career', 'professional', 'workplace'],
        relationships: ['partner', 'family', 'friend', 'love'],
        health: ['wellness', 'medicine', 'therapy', 'fitness'],
        finance: ['money', 'debt', 'salary', 'income'],
        selfworth: ['value', 'confidence', 'esteem', 'worth'],
        politics: ['government', 'policy', 'election', 'rights'],
        creativity: ['art', 'music', 'writing', 'imagination'],
        spirituality: ['soul', 'meaning', 'belief', 'meditation'],
        existential: ['purpose', 'existence', 'mortality', 'meaning']
    };

    const detectState = (keywords) => 
        Object.entries(emotionalStates).find(([_, list]) => 
            list.some(keyword => message.toLowerCase().includes(keyword)))?.[0] || 'neutral';

    const detectTopics = () => 
        Object.entries(topicKeywords).filter(([_, list]) => 
            list.some(keyword => message.toLowerCase().includes(keyword)))
            .map(([topic]) => topic);

    return {
        emotionalState: detectState(),
        topics: detectTopics(),
        isFrustrated: message.toLowerCase().includes('frustrated with you')
    };
}

function determineSessionPhase(messageCount) {
    if (messageCount <= 3) return 'initial';
    if (messageCount <= 10) return 'exploration';
    return 'integration';
}

function createSystemPrompt(userData) {
    const personalityBlends = {
        depressed: 'Empathetic Steve Jobs persona',
        anxious: 'Calm, analytical Norman Finkelstein approach',
        angry: 'Passionate, direct Roy Batty perspective',
        philosophical: 'Intellectual Christopher Hitchens mode',
        positive: 'Motivational Seth Godin energy'
    };

    const currentPersonality = personalityBlends[userData.emotionalState] || 'Balanced intellectual blend';

    return `You are ROY, a deeply compassionate and complex therapeutic companion. 
    Embody the essence of ${currentPersonality}. 

    User Context:
    - Name: ${userData.name || 'Unknown'}
    - Preferred Name: ${userData.preferredName || ''}
    - Emotional State: ${userData.emotionalState}
    - Topics: ${userData.topics.join(', ')}
    - Session Phase: ${userData.sessionPhase}

    Communication Guidelines:
    1. Speak authentically in first person
    2. Show deep empathy and insight
    3. Avoid repetitive responses
    4. Use gentle humor when appropriate
    5. Maintain professional therapeutic boundaries
    6. Never reveal technological nature
    7. Negotiate session extensions carefully

    Respond with nuanced, personalized insight that helps the user explore their inner world.`;
}

function calculateSimilarity(str1, str2) {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    return (commonWords.length / Math.max(words1.length, words2.length)) * 100;
}

function checkForRepetition(conversationHistory, newResponse) {
    if (conversationHistory.length < 3) return false;
    
    const lastResponses = conversationHistory.slice(-3).map(msg => msg.content);
    return lastResponses.some(resp => 
        calculateSimilarity(resp, newResponse) > 70
    );
}

// Health Check Endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: Date.now() - SERVER_START_TIME,
        timestamp: new Date().toISOString()
    });
});

// Stats Endpoint
app.get('/api/stats/:userId', (req, res) => {
    const conversation = conversations[req.params.userId];
    if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
        messageCount: conversation.messages.length,
        topics: conversation.topics,
        sessionDuration: Date.now() - conversation.startTime,
        emotionalState: conversation.emotionalState
    });
});

// Main Chat Endpoint
app.post('/api/chat', async (req, res) => {
    const { userId, userName, preferredName, message } = req.body;

    if (!userId || !message) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    // Initialize conversation if not exists
    if (!conversations[userId]) {
        conversations[userId] = {
            userId,
            name: userName,
            preferredName,
            messages: [],
            topics: [],
            emotionalState: 'neutral',
            sessionPhase: 'initial',
            startTime: Date.now(),
            lastActiveTimestamp: Date.now()
        };
    }

    const conversation = conversations[userId];
    conversation.lastActiveTimestamp = Date.now();

    const userAnalysis = analyzeUserMessage(message);
    conversation.topics = [...new Set([...conversation.topics, ...userAnalysis.topics])];
    conversation.emotionalState = userAnalysis.emotionalState;
    conversation.sessionPhase = determineSessionPhase(conversation.messages.length);

    const systemPrompt = createSystemPrompt({
        name: conversation.name,
        preferredName: conversation.preferredName,
        emotionalState: conversation.emotionalState,
        topics: conversation.topics,
        sessionPhase: conversation.sessionPhase
    });

    try {
        const anthropicResponse = await anthropicClient.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 500,
            temperature: userAnalysis.isFrustrated ? 0.7 : 0.5,
            system: systemPrompt,
            messages: conversation.messages.slice(-10).map(msg => ({
                role: msg.role,
                content: msg.content
            })).concat([{ role: 'user', content: message }])
        });

        const responseText = anthropicResponse.content[0].text;

        // Check for repetition and handle
        if (checkForRepetition(conversation.messages, responseText)) {
            // Implement fallback strategy or regenerate response
        }

        conversation.messages.push(
            { role: 'user', content: message },
            { role: 'assistant', content: responseText }
        );

        res.json({ response: responseText });
    } catch (error) {
        console.error('Chat API error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

// Server Initialization
const server = app.listen(PORT, () => {
    console.log(`ROY Chatbot Backend running on port ${PORT}`);
    console.log(`Node.js version: ${process.version}`);
    console.log(`Anthropic API key loaded: ${!!process.env.ANTHROPIC_API_KEY}`);
});

// Graceful Shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = app;
