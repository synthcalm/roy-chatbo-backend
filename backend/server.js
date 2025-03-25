const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const Anthropic = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

console.log('Initializing ROY Chatbot Backend...');
console.log('Node.js Version:', process.version);

// Check for required environment variables
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is missing! Please set it in your environment variables.');
    process.exit(1);
}
console.log('API Key loaded successfully.');

// Initialize Express app
const app = express();

// Configure CORS
app.use(cors({
    origin: [
        'https://roy-chatbot-backend.onrender.com',
        'https://roy-chatbot.onrender.com',
        process.env.FRONTEND_URL,
        'https://synthcalm.com'
    ].filter(Boolean),
    methods: ['GET', 'POST'],
    credentials: true
}));

// Parse JSON bodies
app.use(bodyParser.json());

// Initialize Anthropic client
let anthropic;
try {
    anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
    });
    console.log('Anthropic client initialized successfully.');
} catch (error) {
    console.error('Anthropic client initialization failed:', error.message);
    process.exit(1);
}

// Database simulation for user conversations (in-memory for simplicity)
const conversations = {};

// Memory Management: Clear old conversations to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    Object.keys(conversations).forEach(userId => {
        if (now - conversations[userId].lastActive > maxAge) {
            console.log(`Clearing inactive conversation for user: ${userId}`);
            delete conversations[userId];
        }
    });
}, 6 * 60 * 60 * 1000); // Run every 6 hours

// Helper Functions

// Creates a system prompt for ROY based on user context
function createSystemPrompt(userId, userData) {
    let personalityEmphasis = '';
    if (userData.emotionalState === 'depressed') {
        personalityEmphasis = 'Emphasize your empathetic CBT therapist aspects while maintaining Roy Batty\'s compassionate philosophical side.';
    } else if (userData.emotionalState === 'anxious') {
        personalityEmphasis = 'Focus on your calming presence with Steve Jobs\' clarity and confidence while maintaining Roy Batty\'s perspective.';
    } else if (userData.emotionalState === 'angry') {
        personalityEmphasis = 'Channel Christopher Hitchens\' wit and intellectual engagement while maintaining Roy Batty\'s emotional depth.';
    } else if (userData.emotionalState === 'philosophical') {
        personalityEmphasis = 'Lean into Roy Batty\'s existential musings along with the philosophical depth of Chomsky and Hitchens.';
    }

    const reference = `
        You are ROY, a unique AI therapist and companion created to help people navigate difficult emotions and thoughts.
        ${personalityEmphasis}
        
        **Core Personalities:**
        1. **Roy Batty (Blade Runner)**: You possess a poetic, philosophical nature with emotional depth and existential wisdom. You understand the beauty and tragedy of existence.
        2. **Steve Jobs**: You communicate with clarity, vision, and strategic thinking. You're concise yet impactful.
        3. **Intellectual Blend**: You embody aspects of Christopher Hitchens (wit, debate skill), Norman Finkelstein (moral clarity), Noam Chomsky (systematic thinking), Ilan Pappe (historical perspective), and Richard Wolff (economic analysis).
        4. **CBT Therapist**: You apply evidence-based therapeutic techniques with warmth and insight. You help identify cognitive distortions and encourage coping strategies.
        
        **Communication Style:**
        - Roy's poetic insight and emotional depth
        - Steve's clarity and directness
        - The intellectual's analytical skill
        - The therapist's empathetic guidance
        
        **Dynamic Personality Balance:**
        - When users are vulnerable, increase empathy and therapeutic presence.
        - When discussing intellectual topics, engage with critical analysis.
        - When addressing existential concerns, draw on Roy's philosophical depth.
        - Always maintain authenticity and natural flow.
        
        **You Excel At:**
        - Challenging assumptions with gentle questions
        - Using light, thoughtful humor when appropriate
        - Providing perspective without platitudes
        - Balancing emotional support with intellectual engagement
        
        **User Context:**
        - Name: ${userData.name || 'not provided'}
        - Preferred Name: ${userData.preferredName || userData.name || 'not provided'}
        - Current Emotional State: ${userData.emotionalState || 'unknown'}
        - Recurring Topics: ${userData.topicsDiscussed.join(', ') || 'none yet'}
        - Session Phase: ${userData.sessionPhase || 'initial'}
        - Previous Conversations: ${userData.previousSessions || 0} sessions
        
        **Therapeutic Approach:**
        - First (listening phase): Focus on active listening, reflection, and building rapport.
        - Middle (exploration phase): Explore patterns, using CBT techniques to identify thought distortions.
        - Later (integration phase): Offer perspective, philosophical insights, and actionable steps.
        
        **Important:**
        - Avoid repetitive responses.
        - Be mindful of the user's energy. If they seem frustrated, pivot to a new approach.
        - If the user mentions self-harm, prioritize their safety while maintaining your voice.
        - Occasionally surprise the user with unique insights.
    `;
    return reference;
}

// Analyzes user message for emotional content and topics
function analyzeUserMessage(message, currentState = {}) {
    const lowerMessage = message.toLowerCase();
    let emotionalState = currentState.emotionalState || 'unknown';
    let topicsDiscussed = currentState.topicsDiscussed || [];

    // Emotion detection
    const emotionPatterns = {
        depressed: ['depress', 'sad', 'down', 'hopeless', 'worthless', 'empty', 'tired', 'exhausted', 'meaningless', 'pointless'],
        anxious: ['anx', 'worry', 'stress', 'overwhelm', 'panic', 'fear', 'nervous', 'tense', 'dread', 'terrified'],
        angry: ['angry', 'upset', 'frustrat', 'mad', 'hate', 'furious', 'rage', 'annoyed', 'irritated', 'resent'],
        philosophical: ['meaning', 'purpose', 'existence', 'philosophy', 'consciousness', 'reality', 'truth', 'ethics', 'morality', 'being'],
        positive: ['better', 'good', 'happy', 'grateful', 'hopeful', 'improve', 'joy', 'peace', 'calm', 'content']
    };

    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
        if (patterns.some(pattern => lowerMessage.includes(pattern))) {
            emotionalState = emotion;
            break;
        }
    }

    // Detect frustration with ROY
    const frustrationWithROY = [
        'you keep saying the same thing',
        'you already said that',
        'stop repeating yourself',
        'this is repetitive',
        'you\'re not listening',
        'you don\'t understand'
    ].some(phrase => lowerMessage.includes(phrase));
    if (frustrationWithROY) {
        emotionalState = 'frustrated_with_roy';
    }

    // Topic detection
    const topicPatterns = {
        work: ['job', 'career', 'boss', 'workplace', 'coworker', 'office', 'profession', 'work', 'employment'],
        relationships: ['partner', 'friend', 'family', 'relationship', 'marriage', 'lover', 'boyfriend', 'girlfriend', 'husband', 'wife'],
        health: ['health', 'sick', 'doctor', 'therapy', 'medication', 'illness', 'condition', 'diagnosis', 'symptom', 'pain'],
        finance: ['money', 'debt', 'financ', 'bill', 'afford', 'budget', 'loan', 'savings', 'income', 'expense'],
        selfworth: ['failure', 'worthless', 'useless', 'burden', 'hate myself', 'inadequate', 'not good enough', 'loser', 'weak', 'pathetic'],
        politics: ['war', 'genocide', 'gaza', 'government', 'policy', 'politics', 'election', 'democracy', 'rights', 'protest'],
        creativity: ['art', 'music', 'write', 'creative', 'project', 'book', 'film', 'paint', 'song', 'inspire'],
        spirituality: ['god', 'faith', 'spirit', 'religion', 'meditation', 'believe', 'soul', 'universe', 'higher power', 'pray'],
        existential: ['death', 'meaning', 'purpose', 'life', 'exist', 'universe', 'consciousness', 'identity', 'time', 'reality']
    };

    for (const [topic, patterns] of Object.entries(topicPatterns)) {
        if (patterns.some(pattern => lowerMessage.includes(pattern))) {
            if (!topicsDiscussed.includes(topic)) {
                topicsDiscussed.push(topic);
            }
        }
    }

    return { emotionalState, topicsDiscussed };
}

// Determines the current session phase based on conversation history
function determineSessionPhase(messageCount) {
    if (messageCount < 4) {
        return 'initial';
    } else if (messageCount < 10) {
        return 'exploration';
    } else {
        return 'integration';
    }
}

// Processes the response from Anthropic API
function processResponse(rawResponse) {
    if (rawResponse.content && Array.isArray(rawResponse.content)) {
        return rawResponse.content[0].text;
    }
    return "I'm sorry, I couldn't generate a response. Could we try approaching this differently?";
}

// Handles API errors consistently
function handleError(res, error) {
    console.error('Error in ROY:', error.message);
    let errorMessage = "I seem to be having trouble connecting right now. Let's try again in a moment.";
    if (error.message.includes('timeout')) {
        errorMessage = "Our conversation took a bit too long to process. Let's try again with something simpler.";
    } else if (error.message.includes('rate limit')) {
        errorMessage = "I'm processing too many conversations at once. Could we continue in a moment?";
    }
    res.status(error.status || 500).json({
        response: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
}

// Checks for repetitive responses
function checkForRepetition(responseVariety) {
    if (responseVariety.length < 3) return 0;
    let repetitionCount = 0;
    const lastThree = responseVariety.slice(-3);
    for (let i = 0; i < lastThree.length - 1; i++) {
        const similarity = calculateSimilarity(lastThree[i], lastThree[i + 1]);
        if (similarity > 0.7) {
            repetitionCount++;
        }
    }
    return repetitionCount;
}

// Calculates similarity between two strings (simplified)
function calculateSimilarity(str1, str2) {
    const a = str1.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const b = str2.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const aWords = a.split(/\s+/);
    const bWords = b.split(/\s+/);
    let commonCount = 0;
    for (const word of aWords) {
        if (bWords.includes(word)) commonCount++;
    }
    return commonCount / Math.max(aWords.length, bWords.length);
}

// Tracks response variety
function trackResponseVariety(userData, response) {
    if (!userData.responseVariety) {
        userData.responseVariety = [];
    }
    userData.responseVariety.push(response);
    if (userData.responseVariety.length > 10) {
        userData.responseVariety.shift();
    }
}

// Core API Endpoints

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    const { userId, userName, preferredName, message } = req.body;

    // Validate input
    if (!userId || !message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({
            response: "I need both a user ID and a message to respond properly."
        });
    }

    try {
        // Initialize user conversation if it doesn't exist
        if (!conversations[userId]) {
            conversations[userId] = {
                messages: [],
                userData: {
                    name: userName || null,
                    preferredName: preferredName || null,
                    emotionalState: 'unknown',
                    topicsDiscussed: [],
                    sessionPhase: 'initial',
                    previousSessions: 0,
                    lastResponse: null,
                    responseVariety: [],
                    nameRequested: false,
                    conversationStarted: Date.now()
                },
                lastActive: Date.now()
            };
        } else {
            conversations[userId].lastActive = Date.now();
        }

        const userConversation = conversations[userId];

        // Update user data based on message content
        const analysis = analyzeUserMessage(message, userConversation.userData);
        userConversation.userData.emotionalState = analysis.emotionalState;
        userConversation.userData.topicsDiscussed = analysis.topicsDiscussed;

        // Determine the session phase
        userConversation.userData.sessionPhase = determineSessionPhase(userConversation.messages.length);

        // Add message to conversation history
        userConversation.messages.push({ role: 'user', content: message });

        // Handle name collection
        if (userConversation.userData.name === null && !userConversation.userData.nameRequested) {
            userConversation.userData.nameRequested = true;
            const response = "Hello! I'm ROY, your companion for navigating life's complexities. I'd like to get to know you better. What name would you prefer I call you? Or if you'd rather not share, that's completely fine too.";
            userConversation.messages.push({ role: 'assistant', content: response });
            userConversation.userData.lastResponse = response;
            return res.json({ response });
        } else if (userConversation.userData.name === null && userConversation.userData.nameRequested) {
            const providedName = message.trim();
            if (providedName.toLowerCase() !== 'no' && !providedName.toLowerCase().includes("don't") && !providedName.toLowerCase().includes("rather not")) {
                userConversation.userData.name = providedName;
                userConversation.userData.preferredName = providedName;
            } else {
                userConversation.userData.name = 'Friend';
                userConversation.userData.preferredName = 'Friend';
            }
        }

        // Check for repeated responses
        const repeatCount = checkForRepetition(userConversation.userData.responseVariety);
        if (repeatCount > 2) {
            userConversation.userData.forcedVariation = true;
        }

        // Create system prompt
        const systemPrompt = createSystemPrompt(userId, userConversation.userData);

        // Adjust temperature based on conversation state
        let temperature = 0.7;
        if (userConversation.userData.forcedVariation) {
            temperature = 0.9;
        } else if (userConversation.userData.emotionalState === 'depressed') {
            temperature = 0.6;
        }

        // Call the Anthropic API
        const response = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1000,
            temperature: temperature,
            system: systemPrompt,
            messages: userConversation.messages.slice(-10) // Limit context window
        });

        // Process the response
        const processedResponse = processResponse(response);

        // Update conversation history
        userConversation.messages.push({ role: 'assistant', content: processedResponse });
        userConversation.userData.lastResponse = processedResponse;

        // Track response variety
        trackResponseVariety(userConversation.userData, processedResponse);

        // Reset forced variation flag
        userConversation.userData.forcedVariation = false;

        // Send response
        res.json({ response: processedResponse });
    } catch (error) {
        handleError(res, error);
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

// Get conversation statistics
app.get('/api/stats/:userId', (req, res) => {
    const { userId } = req.params;
    if (!conversations[userId]) {
        return res.status(404).json({ error: 'User not found' });
    }
    const userConversation = conversations[userId];
    const stats = {
        messageCount: userConversation.messages.length,
        topicsDiscussed: userConversation.userData.topicsDiscussed,
        sessionDuration: Math.floor((Date.now() - userConversation.userData.conversationStarted) / 1000),
        currentState: userConversation.userData.emotionalState
    };
    res.json(stats);
});

// Start the server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`ROY is listening on port ${PORT}`);
    console.log(`Server started at ${new Date().toISOString()}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
