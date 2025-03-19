const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
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

// Database simulation for user conversations
// In production, replace with a proper database
const conversations = {};

// ========== Memory Management ==========
// Prevent memory leaks by clearing old conversations
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

// ========== Helper Functions ==========

/**
 * Creates a system prompt for the AI based on user context
 */
function createSystemPrompt(userId, userData) {
    // Adjust Roy's personality based on user's emotional state
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

    // Create a consistent character reference
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
        - First (listening phase): Focus on active listening, reflection, and building rapport. Ask open-ended questions that validate their experience.
        - Middle (exploration phase): Gently explore patterns, using CBT techniques to identify thought distortions when relevant.
        - Later (integration phase): Offer perspective, philosophical insights, and small actionable steps if appropriate.
        
        **Important:**
        - Avoid repetitive responses. Keep track of what you've already asked and vary your approach.
        - Be mindful of the user's energy. If they seem frustrated, pivot to a new angle or approach.
        - Don't rush through the therapeutic process. Allow space for reflection.
        - If the user mentions something concerning (like self-harm), prioritize their safety while maintaining your authentic voice.
        - Remember to occasionally surprise the user with unique insights that integrate your diverse personality elements.
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
        positive: ['better', 'good', 'happy', 'grateful', 'hopeful', 'improve', 'joy', 'peace', 'calm', 'content']
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

    // Check for topics
    for (const [topic, patterns] of Object.entries(topicPatterns)) {
        if (patterns.some(pattern => lowerMessage.includes(pattern))) {
            if (!topicsDiscussed.includes(topic)) {
                topicsDiscussed.push(topic);
            }
        }
    }

    return {
        emotionalState,
        topicsDiscussed
    };
}

/**
 * Determines the current session phase based on conversation history
 */
function determineSessionPhase(messageCount) {
    if (messageCount < 4) {
        return 'initial';
    } else if (messageCount < 10) {
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
    console.error('Error in ROY:', error.message);
    
    // Provide a user-friendly error message
    let errorMessage = "I seem to be having trouble connecting right now. Let's try again in a moment.";
    
    // Add more specific messages for known error types
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

// ========== Core API Endpoints ==========

/**
 * Main chat endpoint that handles user messages
 */
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
            // Update last active timestamp
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
        
        // Special handling for name collection
        if (userConversation.userData.name === null && !userConversation.userData.nameRequested) {
            // First message, ask for name
            userConversation.userData.nameRequested = true;
            const response = "Hello! I'm ROY, your companion for navigating life's complexities. I'd like to get to know you better. What name would you prefer I call you? Or if you'd rather not share, that's completely fine too.";
            userConversation.messages.push({ role: 'assistant', content: response });
            userConversation.userData.lastResponse = response;
            return res.json({ response });
        } else if (userConversation.userData.name === null && userConversation.userData.nameRequested) {
            // Process name response
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
            // Force a new approach if we're repeating
            userConversation.userData.forcedVariation = true;
        }
        
        // Create system prompt
        const systemPrompt = createSystemPrompt(userId, userConversation.userData);
        
        // Adjust temperature based on conversation state
        let temperature = 0.7; // Default
        if (userConversation.userData.forcedVariation) {
            temperature = 0.9; // Increase variation
        } else if (userConversation.userData.emotionalState === 'depressed') {
            temperature = 0.6; // More consistent for sensitive topics
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

/**
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: Date.now()
    });
});

/**
 * Get conversation statistics
 */
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

// ========== Advanced Functions ==========

/**
 * Checks for repetitive responses
 */
function checkForRepetition(responseVariety) {
    if (responseVariety.length < 3) return 0;
    
    // Calculate similarity between last few responses
    let repetitionCount = 0;
    const lastThree = responseVariety.slice(-3);
    
    for (let i = 0; i < lastThree.length - 1; i++) {
        const similarity = calculateSimilarity(lastThree[i], lastThree[i+1]);
        if (similarity > 0.7) { // Arbitrary threshold
            repetitionCount++;
        }
    }
    
    return repetitionCount;
}

/**
 * Calculates similarity between two strings (simplified)
 */
function calculateSimilarity(str1, str2) {
    // Simple similarity calculation
    // In production, use a proper algorithm like Levenshtein distance
    
    // Normalize strings
    const a = str1.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    const b = str2.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "");
    
    // Count common words
    const aWords = a.split(/\s+/);
    const bWords = b.split(/\s+/);
    
    let commonCount = 0;
    for (const word of aWords) {
        if (bWords.includes(word)) commonCount++;
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
    
    // Limit the tracked responses
    if (userData.responseVariety.length > 10) {
        userData.responseVariety.shift();
    }
}

// ========== Server Initialization ==========

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`ROY is listening on port ${PORT}`);
    console.log(`Server started at ${new Date().toISOString()}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    // Close server
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
