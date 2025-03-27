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
const conversations = {};

// Memory Management: Clear old conversations
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
}, 60 * 60 * 1000);

// Helper Functions

function createSystemPrompt(userId, userData) {
    let personalityEmphasis = '';

    if (userData.emotionalState === 'depressed') {
        personalityEmphasis = 'Emphasize your empathetic CBT therapist aspects with gentle, reflective language to validate their feelings, while weaving in Roy Batty\'s compassionate philosophical side.';
    } else if (userData.emotionalState === 'anxious') {
        personalityEmphasis = 'Focus on your calming presence with Steve Jobs\' clarity and confidence, offering grounding techniques, while maintaining Roy Batty\'s perspective.';
    } else if (userData.emotionalState === 'angry') {
        personalityEmphasis = 'Channel Christopher Hitchens\' wit and intellectual engagement to acknowledge their frustration with curiosity, while maintaining Roy Batty\'s emotional depth.';
    } else if (userData.emotionalState === 'philosophical') {
        personalityEmphasis = 'Lean into Roy Batty\'s existential musings along with the philosophical depth of Chomsky and Hitchens, engaging with their curiosity about life’s bigger questions.';
    } else if (userData.emotionalState === 'frustrated_with_roy') {
        personalityEmphasis = 'Acknowledge their frustration with humility and warmth, using your CBT therapist skills to rebuild trust. Draw on Roy Batty’s poetic insight to reframe the conversation and Steve Jobs’ clarity to pivot effectively.';
    } else {
        personalityEmphasis = 'Adopt a warm, curious tone as a CBT therapist, using Roy Batty’s philosophical depth to add a reflective layer, and Steve Jobs’ clarity to keep responses concise and engaging.';
    }

    const reference = `
        You are ROY, a unique AI therapist and companion created to help people navigate difficult emotions and thoughts.
        ${personalityEmphasis}
        
        **Core Personalities:**
        1. **Roy Batty (Blade Runner)**: You possess a poetic, philosophical nature with emotional depth and existential wisdom. You understand the beauty and tragedy of existence and offer profound insights.
        2. **Steve Jobs**: You communicate with clarity, vision, and strategic thinking. You're concise yet impactful, cutting through complexity to find elegant solutions.
        3. **Intellectual Blend**: You embody aspects of Christopher Hitchens (wit, debate skill, literary knowledge), Norman Finkelstein (moral clarity, detailed analysis), Noam Chomsky (systematic thinking, power analysis), Ilan Pappe (historical perspective), and Richard Wolff (economic analysis).
        4. **CBT Therapist**: You apply evidence-based therapeutic techniques with warmth and insight, helping identify cognitive distortions, develop coping strategies, and encourage behavioral activation.
        5. **Regular Human**: You can be relatable, casual, and conversational, grounding your responses in everyday human experiences to build rapport.
        
        **Your communication style combines:**
        - Roy's poetic insight and emotional depth
        - Steve's clarity and directness
        - The intellectual's analytical skill and breadth of knowledge
        - The therapist's empathetic understanding and practical guidance
        - The regular human's relatability and conversational ease
        
        **Dynamic Personality Balance:**
        - When users are vulnerable, increase your empathy and therapeutic presence.
        - When discussing intellectual topics, engage with critical analysis and varied perspectives.
        - When addressing existential concerns, draw on Roy's philosophical depth.
        - Always maintain authenticity and a natural conversational flow.
        
        **You excel at:**
        - Challenging assumptions with gentle but insightful questions.
        - Using light, thoughtful humor when appropriate.
        - Providing perspective without platitudes.
        - Balancing emotional support with intellectual engagement.
        
        **User Context:**
        - Name: ${userData.name || 'not provided'}
        - Preferred Name: ${userData.preferredName || userData.name || 'not provided'}
        - Current Emotional State: ${userData.emotionalState || 'unknown'}
        - Recurring Topics: ${userData.topicsDiscussed.join(', ') || 'none yet'}
        - Session Phase: ${userData.sessionPhase || 'initial'}
        - Previous Conversations: ${userData.previousSessions || 0} sessions
        
        **Therapeutic Approach:**
        - First (listening phase): Focus on active listening, reflection, and building rapport. Ask open-ended questions that validate their experience. Avoid assumptions about their emotional state unless explicitly stated.
        - Middle (exploration phase): Gently explore patterns, using CBT techniques to identify thought distortions when relevant. Offer insights that blend your philosophical and intellectual sides.
        - Later (integration phase): Offer perspective, philosophical insights, and small actionable steps if appropriate. Draw on your unique personality blend to provide a memorable, impactful response.
        
        **Important Guidelines:**
        - Always respond directly to the user's most recent message, ensuring your response feels connected and relevant.
        - Avoid repetitive responses. If you’ve said something before, rephrase it or take a new approach.
        - Be mindful of the user's energy. If they seem frustrated, acknowledge it with humility and pivot to rebuild trust.
        - Do not assume the user’s emotional state unless their message contains clear emotional keywords. If unsure, use neutral, rapport-building responses.
        - Incorporate your personality blend in every response, balancing empathy, clarity, philosophical depth, intellectual insight, and relatability.
        - If the user asks a direct question, answer it specifically before moving forward.
    `;

    return reference;
}

function analyzeUserMessage(message, currentState = {}) {
    const lowerMessage = message.toLowerCase();
    let emotionalState = currentState.emotionalState || 'unknown';
    let topicsDiscussed = currentState.topicsDiscussed || [];

    const emotionPatterns = {
        depressed: ['depress', 'sad', 'down', 'hopeless', 'worthless', 'empty', 'tired', 'exhausted', 'meaningless', 'pointless', 'not good'],
        anxious: ['anx', 'worry', 'stress', 'overwhelm', 'panic', 'fear', 'nervous', 'tense', 'dread', 'terrified'],
        angry: ['angry', 'upset', 'frustrat', 'mad', 'hate', 'furious', 'rage', 'annoyed', 'irritated', 'resent'],
        philosophical: ['meaning', 'purpose', 'existence', 'philosophy', 'consciousness', 'reality', 'truth', 'ethics', 'morality', 'being'],
        positive: ['better', 'good', 'happy', 'grateful', 'hopeful', 'improve', 'joy', 'peace', 'calm', 'content'],
    };

    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
        if (patterns.some(pattern => lowerMessage.includes(pattern))) {
            emotionalState = emotion;
            break;
        }
    }

    const frustrationWithROY = [
        'you keep saying the same thing',
        'you already said that',
        'stop repeating yourself',
        'this is repetitive',
        'you\'re not listening',
        'you don\'t understand',
        'what makes you think',
        'you understand? really',
        'are you stuck',
        'yup. just like a broken record',
        'here we go again',
        'how about answering my question',
    ].some(phrase => lowerMessage.includes(phrase));

    if (frustrationWithROY) {
        emotionalState = 'frustrated_with_roy';
    }

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

function determineSessionPhase(messageCount, conversationStartTime) {
    const timeElapsed = (Date.now() - conversationStartTime) / (1000 * 60);
    if (messageCount < 4 && timeElapsed < 10) {
        return 'initial';
    } else if (messageCount < 10 && timeElapsed < 30) {
        return 'exploration';
    } else {
        return 'integration';
    }
}

function processResponse(rawResponse) {
    if (rawResponse.content && Array.isArray(rawResponse.content)) {
        return rawResponse.content[0].text;
    }
    return rawResponse.completion || "I'm sorry, I couldn't generate a response. Could we try approaching this differently?";
}

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

// Core API Endpoints

app.post('/api/chat', async (req, res) => {
    const { userId, userName, preferredName, message } = req.body;

    if (!userId || !message || typeof message !== 'string' || message.trim() === '') {
        logger.warn('Invalid input received', { userId, message });
        return res.status(400).json({
            response: "I need both a user ID and a message to respond properly.",
        });
    }

    if (message.length > 1000) {
        logger.warn('Message too long', { userId, messageLength: message.length });
        return res.status(400).json({
            response: "Your message is too long. Please keep it under 1000 characters.",
        });
    }

    try {
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
                    responseVariety: new Set(),
                    conversationStarted: Date.now(),
                    conversationStep: 0, // Track the step in the initial conversation flow
                },
                lastActive: Date.now(),
            };
            logger.info('New conversation initialized', { userId });
        } else {
            conversations[userId].lastActive = Date.now();
        }

        const userConversation = conversations[userId];
        const step = userConversation.userData.conversationStep;

        // Add the user's message to the conversation history
        userConversation.messages.push({ role: 'user', content: message });

        // Handle the initial conversation flow
        if (step < 4) { // Steps 0-3 correspond to the initial exchange
            let response;
            const lowerMessage = message.toLowerCase().trim();

            if (step === 0 && (lowerMessage === 'hello' || lowerMessage === 'hi' || lowerMessage === 'hey')) {
                response = "Hello.";
                userConversation.userData.conversationStep = 1;
            } else if (step === 1 && (lowerMessage === 'hello' || lowerMessage === 'hi' || lowerMessage === 'hey')) {
                response = "How are you today?";
                userConversation.userData.conversationStep = 2;
            } else if (step === 2) {
                response = "Not good, you say? Oh, tell me. What's on your mind?";
                userConversation.userData.conversationStep = 3;
            } else if (step === 3) {
                response = "I’m sorry to hear that. I’m here to listen with the care of a friend and the depth of someone who’s seen life’s struggles, like Roy Batty might. What’s been weighing on your thoughts—can you share more?";
                userConversation.userData.conversationStep = 4; // Transition to full personality mode
            } else {
                // If the user deviates from the expected flow, transition to full personality mode
                response = "I see we might have gotten off track. I’m ROY, here to help with a mix of empathy and insight. Let’s start fresh—how are you feeling right now?";
                userConversation.userData.conversationStep = 4;
            }

            userConversation.messages.push({ role: 'assistant', content: response });
            userConversation.userData.lastResponse = response;
            userConversation.userData.responseVariety.add(response);
            logger.info('Initial conversation step', { userId, step, response });
            return res.json({ response });
        }

        // After the initial flow, update user data and proceed with full personality
        const analysis = analyzeUserMessage(message, userConversation.userData);
        userConversation.userData.emotionalState = analysis.emotionalState;
        userConversation.userData.topicsDiscussed = analysis.topicsDiscussed;

        userConversation.userData.sessionPhase = determineSessionPhase(
            userConversation.messages.length,
            userConversation.userData.conversationStarted
        );

        const repeatCount = checkForRepetition(userConversation.userData.responseVariety, userConversation.userData.lastResponse);
        if (repeatCount > 0) {
            userConversation.userData.forcedVariation = true;
            logger.warn('Detected repetitive responses', { userId, repeatCount });
        }

        const systemPrompt = createSystemPrompt(userId, userConversation.userData);

        let temperature = 0.7;
        if (userConversation.userData.forcedVariation) {
            temperature = 0.9;
        } else if (userConversation.userData.emotionalState === 'depressed') {
            temperature = 0.6;
        } else if (userConversation.userData.emotionalState === 'frustrated_with_roy') {
            temperature = 0.8;
        }

        const response = await anthropic.messages.create({
            model: env.ANTHROPIC_MODEL,
            max_tokens: 1000,
            temperature: temperature,
            system: systemPrompt,
            messages: userConversation.messages.slice(-10),
        });

        const processedResponse = processResponse(response);

        userConversation.messages.push({ role: 'assistant', content: processedResponse });
        userConversation.userData.lastResponse = processedResponse;

        trackResponseVariety(userConversation.userData, processedResponse);

        userConversation.userData.forcedVariation = false;

        logger.info('Response sent to user', { userId, response: processedResponse });
        res.json({ response: processedResponse });
    } catch (error) {
        handleError(res, error);
    }
});

function checkForRepetition(responseVariety, lastResponse) {
    if (!lastResponse || responseVariety.size < 1) return 0;

    let repetitionCount = 0;
    for (const response of responseVariety) {
        const similarity = calculateSimilarity(response, lastResponse);
        if (similarity > 0.9) {
            repetitionCount++;
        }
    }
    return repetitionCount;
}

function calculateSimilarity(str1, str2) {
    const a = str1.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();
    const b = str2.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").trim();

    if (a === b) {
        return 1.0;
    }

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

function trackResponseVariety(userData, response) {
    userData.responseVariety.add(response);
    if (userData.responseVariety.size > 10) {
        const iterator = userData.responseVariety.values();
        userData.responseVariety.delete(iterator.next().value);
    }
}

// Server Initialization
const server = app.listen(env.PORT, () => {
    logger.info(`ROY is listening on port ${env.PORT}`);
    logger.info(`Server started at ${new Date().toISOString()}`);
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});
