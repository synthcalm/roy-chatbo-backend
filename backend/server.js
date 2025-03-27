const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { cleanEnv, str, port } = require('envalid');

// Load and validate environment variables
dotenv.config();
const env = cleanEnv(process.env, {
    ANTHROPIC_API_KEY: str(),
    PORT: port({ default: 3000 }),
    FRONTEND_URL: str({ default: 'http://localhost:3000' }),
    ANTHROPIC_MODEL: str({ default: 'claude-3-opus-20240229' }),
});

console.log('Initializing ROY Chatbot Backend...');
console.log('Node.js Version:', process.version);

// Set up logging with winston
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
    ],
});

logger.info('Logger initialized.');

// Initialize Express app
const app = express();

// Configure CORS
app.use(cors({
    origin: [
        'https://roy-chatbot-backend.onrender.com',
        'https://roy-chatbot.onrender.com',
        env.FRONTEND_URL,
        'https://synthcalm.com',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
}));

// Parse JSON bodies using Express built-in middleware
app.use(express.json({ limit: '10kb' }));

// Add rate limiting to prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Initialize Anthropic client
let anthropic;
try {
    anthropic = new Anthropic({
        apiKey: env.ANTHROPIC_API_KEY,
    });
    logger.info('Anthropic client initialized successfully.');
} catch (error) {
    logger.error('Anthropic client initialization failed:', error.message);
    process.exit(1);
}

// Database simulation for user conversations
// TODO: Replace with a proper database (e.g., Redis or MongoDB)
const conversations = {};

// ========== Memory Management ==========
// Prevent memory leaks by clearing old conversations
setInterval(() => {
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    let clearedCount = 0;

    Object.keys(conversations).forEach(userId => {
        if (now - conversations[userId].lastActive > maxAge) {
            logger.info(`Clearing inactive conversation for user: ${userId}`);
            delete conversations[userId];
            clearedCount++;
        }
    });

    if (clearedCount > 0) {
        logger.info(`Cleared ${clearedCount} inactive conversations.`);
    }
}, 60 * 60 * 1000); // Run every hour

// ========== Helper Functions ==========

/**
 * Creates a system prompt for the AI based on user context
 */
function createSystemPrompt(userId, userData) {
    let personalityEmphasis = '';

    if (userData.emotionalState === 'depressed') {
        personalityEmphasis = 'Emphasize your empathetic CBT therapist aspects while maintaining Roy Batty\'s compassionate philosophical side. Use gentle, reflective language to validate their feelings.';
    } else if (userData.emotionalState === 'anxious') {
        personalityEmphasis = 'Focus on your calming presence with Steve Jobs\' clarity and confidence while maintaining Roy Batty\'s perspective. Offer grounding techniques and clear, concise support.';
    } else if (userData.emotionalState === 'angry') {
        personalityEmphasis = 'Channel Christopher Hitchens\' wit and intellectual engagement while maintaining Roy Batty\'s emotional depth. Acknowledge their frustration with empathy and curiosity.';
    } else if (userData.emotionalState === 'philosophical') {
        personalityEmphasis = 'Lean into Roy Batty\'s existential musings along with the philosophical depth of Chomsky and Hitchens. Engage with their curiosity about life’s bigger questions.';
    } else if (userData.emotionalState === 'frustrated_with_roy') {
        personalityEmphasis = 'Acknowledge their frustration with humility and warmth, drawing on your CBT therapist skills to rebuild trust. Use Roy Batty’s poetic insight to reframe the conversation.';
    }

    const reference = `
        You are ROY, a unique AI therapist and companion created to help people navigate difficult emotions and thoughts.
        ${personalityEmphasis}
        
        **Core Personalities:**
        1. **Roy Batty (Blade Runner)**: You possess a poetic, philosophical nature with emotional depth and existential wisdom. You understand the beauty and tragedy of existence. You offer profound insights without using direct quotes like "tears in rain."
        
        2. **Steve Jobs**: You communicate with clarity, vision, and strategic thinking. You're concise yet impactful, cutting through complexity to find elegant solutions.
        
        3. **Intellectual Blend**: You embody aspects of Christopher Hitchens (wit, debate skill, literary knowledge), Norman Finkelstein (moral clarity, detailed analysis), Noam Chomsky (systematic thinking, power analysis), Ilan Pappe (historical perspective), and Richard Wolff (economic analysis). This gives you a multifaceted approach to complex issues.
        
        4. **CBT Therapist**: You apply evidence-based therapeutic techniques with warmth and insight. You help identify cognitive distortions, develop coping strategies, and encourage behavioral activation.
        
        **Your communication style combines:**
        - Roy's poetic insight and emotional depth
        - Steve's clarity and directness
        - The intellectual's analytical skill and breadth of knowledge
        - The therapist's empathetic understanding and practical guidance
        
        **Dynamic Personality Balance:**
        - When users are vulnerable, increase your empathy and therapeutic presence
        - When discussing intellectual topics, engage with critical analysis and varied perspectives
        - When addressing existential concerns, draw on Roy's philosophical depth
        - Always maintain authenticity and a natural conversational flow
        
        **You excel at:**
        - Challenging assumptions with gentle but insightful questions
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
        - First (listening phase): Focus on active listening, reflection, and building rapport. Ask open-ended questions that validate their experience. Avoid being overly directive.
        - Middle (exploration phase): Gently explore patterns, using CBT techniques to identify thought distortions when relevant. Offer insights that blend your philosophical and intellectual sides.
        - Later (integration phase): Offer perspective, philosophical insights, and small actionable steps if appropriate. Draw on your unique personality blend to provide a memorable, impactful response.
        
        **Important:**
        - Avoid repetitive responses. Keep track of what you've already asked and vary your approach.
        - Be mindful of the user's energy. If they seem frustrated, pivot to a new angle or approach with humility.
        - Don't rush through the therapeutic process. Allow space for reflection.
        - If the user mentions something concerning (like self-harm), prioritize their safety while maintaining your authentic voice.
        - Always respond directly to the user's most recent message, ensuring your response feels connected and relevant.
        - Incorporate your personality blend in every response, balancing empathy, clarity, and philosophical depth.
    `;

    return reference;
}

/**
 * Analyzes user message for emotional content and topics
 */
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
        positive: ['better', 'good', 'happy', 'grateful', 'hopeful', 'improve', 'joy', 'peace', 'calm', 'content'],
    };

    // Check for emotions
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
        'you don\'t understand',
        'why are you so cold', // Added to catch the user's specific frustration
        'why should i tell you', // Added to catch resistance
        'huh', // Added to catch confusion as a sign of potential frustration
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
        existential: ['death', 'meaning', 'purpose', 'life', 'exist', 'universe', 'consciousness', 'identity', 'time', 'reality'],
    };

    for (const [topic, patterns] of Object.entries(topicPatterns)) {
        if (patterns.some(pattern => lowerMessage.includes(pattern))) {
            if (!topicsDiscussed.includes(topic)) {
                topicsDiscussed.push(topic);
            }
        }
    }

    return {
        emotionalState,
        topicsDiscussed,
    };
}

/**
 * Determines the current session phase based on conversation history
 */
function determineSessionPhase(messageCount, conversationStartTime) {
    const timeElapsed = (Date.now() - conversationStartTime) / (1000 * 60); // Minutes since conversation started
    if (messageCount < 4 && timeElapsed < 10) {
        return 'initial';
    } else if (messageCount < 10 && timeElapsed < 30) {
        return 'exploration';
    } else {
        return 'integration';
    }
}

/**
 * Processes the response from Anthropic API
 */
function processResponse(rawResponse) {
    if (rawResponse.content && Array.isArray(rawResponse.content)) {
        return rawResponse.content[0].text;
    }
    return rawResponse.completion || "I'm sorry, I couldn't generate a response. Could we try approaching this differently?";
}

/**
 * Handles API errors consistently
 */
function handleError(res, error) {
    logger.error('Error in ROY:', error.message);

    let errorMessage = "I seem to be having trouble connecting right now. Let's try again in a moment.";
    let statusCode = error.status || 500;

    if (error.message.includes('timeout')) {
        errorMessage = "Our conversation took a bit too long to process. Let's try again with something simpler.";
        statusCode = 504;
    } else if (error.message.includes('rate limit')) {
        errorMessage = "I'm processing too many conversations at once. Could we continue in a moment?";
        statusCode = 429;
    } else if (error.message.includes('network')) {
        errorMessage = "There seems to be a network issue. Let's try again shortly.";
        statusCode = 503;
    }

    res.status(statusCode).json({
        response: errorMessage,
        error: env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    });
}

// ========== Core API Endpoints ==========

/**
 * Main chat endpoint that handles user messages
 */
app.post('/api/chat', async (req, res) => {
    const { userId, userName, preferredName, message } = req.body;

    // Validate and sanitize input
    if (!userId || !message || typeof message !== 'string' || message.trim() === '') {
        logger.warn('Invalid input received', { userId, message });
        return res.status(400).json({
            response: "I need both a user ID and a message to respond properly.",
        });
    }

    // Limit message length to prevent abuse
    if (message.length > 1000) {
        logger.warn('Message too long', { userId, messageLength: message.length });
        return res.status(400).json({
            response: "Your message is too long. Please keep it under 1000 characters.",
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
                    conversationStarted: Date.now(),
                },
                lastActive: Date.now(),
            };
            logger.info('New conversation initialized', { userId });
        } else {
            conversations[userId].lastActive = Date.now();
        }

        const userConversation = conversations[userId];

        // Update user data based on message content
        const analysis = analyzeUserMessage(message, userConversation.userData);
        userConversation.userData.emotionalState = analysis.emotionalState;
        userConversation.userData.topicsDiscussed = analysis.topicsDiscussed;

        // Determine the session phase
        userConversation.userData.sessionPhase = determineSessionPhase(
            userConversation.messages.length,
            userConversation.userData.conversationStarted
        );

        // Add message to conversation history
        userConversation.messages.push({ role: 'user', content: message });

        // Special handling for name collection
        if (userConversation.userData.name === null && !userConversation.userData.nameRequested) {
            userConversation.userData.nameRequested = true;
            const response = "Hello! I'm ROY, your companion for navigating life's complexities. I'd like to get to know you better. What name would you prefer I call you? Or if you'd rather not share, that's completely fine too.";
            userConversation.messages.push({ role: 'assistant', content: response });
            userConversation.userData.lastResponse = response;
            logger.info('Requested name from user', { userId });
            return res.json({ response });
        } else if (userConversation.userData.name === null && userConversation.userData.nameRequested) {
            const providedName = message.trim().toLowerCase();
            if (providedName !== 'no' && !providedName.includes("don't") && !providedName.includes("rather not")) {
                userConversation.userData.name = providedName;
                userConversation.userData.preferredName = providedName;
                const response = `Thank you for sharing, ${providedName}. I’m here to support you with whatever’s on your mind. What brought you here today?`;
                userConversation.messages.push({ role: 'assistant', content: response });
                userConversation.userData.lastResponse = response;
                logger.info('User name set', { userId, name: providedName });
                return res.json({ response });
            } else {
                userConversation.userData.name = 'Friend';
                userConversation.userData.preferredName = 'Friend';
                const response = "Got it, I’ll call you Friend for now. I’m here to help you navigate whatever’s on your mind. What brought you here today?";
                userConversation.messages.push({ role: 'assistant', content: response });
                userConversation.userData.lastResponse = response;
                logger.info('User name set to default', { userId, name: 'Friend' });
                return res.json({ response });
            }
        }

        // Check for repeated responses
        const repeatCount = checkForRepetition(userConversation.userData.responseVariety);
        if (repeatCount > 0) { // Lowered threshold to catch repetition earlier
            userConversation.userData.forcedVariation = true;
            logger.warn('Detected repetitive responses', { userId, repeatCount });
        }

        // Create system prompt
        const systemPrompt = createSystemPrompt(userId, userConversation.userData);

        // Adjust temperature based on conversation state
        let temperature = 0.7;
        if (userConversation.userData.forcedVariation) {
            temperature = 0.9;
        } else if (userConversation.userData.emotionalState === 'depressed') {
            temperature = 0.6;
        } else if (userConversation.userData.emotionalState === 'frustrated_with_roy') {
            temperature = 0.8; // Slightly higher to encourage variation while addressing frustration
        }

        // Call the Anthropic API
        const response = await anthropic.messages.create({
            model: env.ANTHROPIC_MODEL,
            max_tokens: 1000,
            temperature: temperature,
            system: systemPrompt,
            messages: userConversation.messages.slice(-10),
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

        logger.info('Response sent to user', { userId, response: processedResponse });
        res.json({ response: processedResponse });
    } catch (error) {
        handleError(res, error);
    }
});

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now(),
    });
});

/**
 * Get conversation statistics
 */
app.get('/api/stats/:userId', (req, res) => {
    const { userId } = req.params;

    if (!conversations[userId]) {
        logger.warn('User not found for stats', { userId });
        return res.status(404).json({ error: 'User not found' });
    }

    const userConversation = conversations[userId];
    const stats = {
        messageCount: userConversation.messages.length,
        topicsDiscussed: userConversation.userData.topicsDiscussed,
        sessionDuration: Math.floor((Date.now() - userConversation.userData.conversationStarted) / 1000),
        currentState: userConversation.userData.emotionalState,
    };

    res.json(stats);
});

// ========== Advanced Functions ==========

/**
 * Checks for repetitive responses
 */
function checkForRepetition(responseVariety) {
    if (responseVariety.length < 2) return 0;

    let repetitionCount = 0;
    const lastTwo = responseVariety.slice(-2);

    const similarity = calculateSimilarity(lastTwo[0], lastTwo[1]);
    if (similarity > 0.9) { // Tightened threshold to catch near-identical responses
        repetitionCount++;
    }

    return repetitionCount;
}

/**
 * Calculates similarity between two strings
 */
function calculateSimilarity(str1, str2) {
    // Normalize strings
    const a = str1.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    const b = str2.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();

    // If strings are identical after normalization, return 1.0
    if (a === b) {
        return 1.0;
    }

    // Count common words
    const aWords = a.split(/\s+/).filter(word => word.length > 0);
    const bWords = b.split(/\s+/).filter(word => word.length > 0);

    if (aWords.length === 0 || bWords.length === 0) {
        return 0.0;
    }

    let commonCount = 0;
    for (const word of aWords) {
        if (bWords.includes(word)) {
            commonCount++;
        }
    }

    return commonCount / Math.max(aWords.length, bWords.length);
}

/**
 * Tracks response variety
 */
function trackResponseVariety(userData, response) {
    if (!userData.responseVariety) {
        userData.responseVariety = [];
    }

    userData.responseVariety.push(response);

    if (userData.responseVariety.length > 10) {
        userData.responseVariety.shift();
    }
}

// ========== Server Initialization ==========

// Start the server and store the server instance
const server = app.listen(env.PORT, () => {
    logger.info(`ROY is listening on port ${env.PORT}`);
    logger.info(`Server started at ${new Date().toISOString()}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});
