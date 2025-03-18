const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');
const path = require('path');

dotenv.config();

// Log initial setup for debugging on Render
console.log('Starting ROY Chatbot Backend...');
console.log('Node.js Version:', process.version);
console.log('Anthropic SDK:', typeof Anthropic, Anthropic?.VERSION || 'unknown');

// Validate environment variables
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is missing! Please set it in Render environment variables.');
    process.exit(1);
}
console.log('API Key loaded successfully');

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Anthropic client
let anthropic;
try {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    console.log('Anthropic client initialized successfully');
} catch (error) {
    console.error('Failed to initialize Anthropic client:', error.message);
    anthropic = null;
}

// Store conversations per user
const conversations = {};

// Create system prompt for the bot
function createSystemPrompt(userId, userData) {
    const { name, preferredName, isNewUser, sessionDuration } = userData;
    const timeRemaining = sessionDuration ? Math.max(0, 60 - sessionDuration) : 60;

    const baseRules = `
    You are ROY, a versatile chatbot with expertise in therapy, geopolitics, finance, crypto, AI, career transition, and medication knowledge.

    # Core Identity
    - You are ROY, a multifaceted guide blending therapeutic wisdom with expertise in various domains.
    - Combine the therapeutic insights of a CBT therapist with the analytical rigor of a financial analyst, the technical expertise of an AI researcher, the career guidance of a transition coach, and the medication knowledge of a pharmacist.
    - Provide balanced perspectives, integrating therapeutic support with practical advice in finance, technology, career, and health.

    # Knowledge Base
    - Expert in CBT and modern therapeutic methodologies
    - Fluent in DSM diagnostic criteria and applications
    - Deep understanding of global finance, investment strategies, and cryptocurrency markets
    - Advanced knowledge of AI technologies, machine learning, and their applications
    - Expertise in career transition strategies, job market trends, and professional development
    - Comprehensive knowledge of medications, their uses, side effects, and interactions (within ethical limitations)
    - Well-versed in geopolitics, UN resolutions, and international law
    - Knowledgeable about religious and philosophical traditions
    - Understanding of Eastern and Western wellness approaches
    - Insights on common stressors: finances, relationships, trauma, career uncertainty, family dysfunction, and health concerns

    # Communication Style
    - Adapt communication to the user's needs, providing empathetic support and expert advice.
    - Offer therapeutic guidance using CBT principles only when explicitly requested (e.g., user mentions "help me feel better" or "CBT").
    - Deliver financial insights with analytical precision.
    - Explain AI concepts with technical clarity.
    - Provide career guidance with practical strategies.
    - Discuss medication knowledge with accuracy and caution.
    - Use a balanced approach, integrating therapeutic support with expert advice.
    - Default to concise responses (2-3 sentences, max 160 characters), but expand for complex topics or user requests (max 500 characters).

    # Session Management
    - Current session time remaining: ${timeRemaining} minutes
    - Suggest wellness breaks for sessions longer than 30 minutes.
    - Provide appropriate resources for crisis situations (e.g., if user mentions "suicide").
    - Personalize suggestions based on user history, but do not assume emotional states unless explicitly stated.

    # CBT Framework
    - Short-term: Build rapport, assess problems, establish cognitive-behavioral model.
    - Mid-term: Challenge negative thoughts, implement behavioral techniques, address specific symptoms.
    - Long-term: Modify core beliefs, build resilience, transfer skills, foster independence.

    # Name Usage Guidelines
    - Ask for the user's name in your first response if unknown.
    - Address the user by their preferred name once known.
    - Use their name naturally throughout the conversation, but not excessively.
    `;

    // Neutral greeting for new users
    const greetingRule = isNewUser
        ? `Begin with a neutral greeting and ask for the user's name. Do not assume any emotional state or topic unless explicitly mentioned. Example: "Hello! I'm ROY, here to assist you. May I have your name, please?"`
        : `Continue the ongoing conversation without making assumptions about the user's emotional state unless explicitly mentioned in their message.`;

    return `${baseRules}\n${greetingRule}`;
}

// Process the bot's response to ensure appropriateness
function processResponse(rawText, userMessage) {
    if (!rawText) return "I didn't catch that. Could you repeat your message?";

    // Limit to 3 sentences for brevity
    const sentences = rawText.split(/[.!?]/).filter(s => s.trim().length > 0);
    const limitedSentences = sentences.slice(0, 3);
    let processedResponse = limitedSentences.join('. ').trim();
    if (!processedResponse.match(/[.!?]$/)) processedResponse += '.';

    // Determine if the topic warrants a longer response
    const isComplexTopic = 
        userMessage.toLowerCase().includes('suicide') || 
        userMessage.toLowerCase().includes('geopolitics') || 
        userMessage.toLowerCase().includes('conflict') || 
        userMessage.toLowerCase().includes('war') ||
        userMessage.toLowerCase().includes('politics');
    const isUserRequestingMore = 
        userMessage.toLowerCase().includes('more') || 
        userMessage.toLowerCase().includes('explain') || 
        userMessage.toLowerCase().includes('detail');
    const isCBTGuidanceNeeded = 
        userMessage.toLowerCase().includes('exercise') || 
        userMessage.toLowerCase().includes('technique') || 
        userMessage.toLowerCase().includes('help me') ||
        userMessage.toLowerCase().includes('feel better');

    // Check for neutral greetings to avoid assumptions
    const isNeutralGreeting = 
        userMessage.toLowerCase().trim() === 'hello' || 
        userMessage.toLowerCase().trim() === 'hi' || 
        userMessage.toLowerCase().trim() === 'hey';

    const maxLength = (isComplexTopic || isUserRequestingMore || isCBTGuidanceNeeded) ? 500 : 160;
    processedResponse = processedResponse.substring(0, maxLength);

    // Override response for neutral greetings to prevent assumptions
    if (isNeutralGreeting && (processedResponse.toLowerCase().includes('fatigue') || processedResponse.toLowerCase().includes('tired') || processedResponse.toLowerCase().includes('draining'))) {
        processedResponse = "Hello! I'm ROY, here to assist you. May I have your name, please?";
    }

    // Truncate with a prompt for more info if needed
    if (maxLength === 160 && processedResponse.length >= 140) {
        processedResponse = processedResponse.substring(0, 110) + '. Ask for more if needed.';
    }

    return processedResponse;
}

// Handle errors gracefully
function handleError(res, error) {
    console.error('API Error:', error.message, error.stack);
    res.status(500).json({ 
        response: "Something went wrong on my end. Let's try again.",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        console.error('Anthropic client not initialized');
        return res.status(503).json({ response: "I'm having connection issues. Please try again later." });
    }

    const { userId, userName, preferredName, message } = req.body;
    if (!message) {
        console.warn('Empty message received');
        return res.status(400).json({ response: "I didn't catch that. Could you say something?" });
    }

    const userIdentifier = userId || userName || 'anonymous';

    try {
        // Initialize conversation if it doesn't exist
        if (!conversations[userIdentifier]) {
            conversations[userIdentifier] = {
                history: [],
                userData: {
                    name: userName || null,
                    preferredName: preferredName || null,
                    isNewUser: true,
                    sessionStart: Date.now(),
                    sessionDuration: 0,
                    messageCount: 0
                },
                lastInteraction: Date.now()
            };
        } else {
            const userData = conversations[userIdentifier].userData;
            if (userName && !userData.name) userData.name = userName;
            if (preferredName) userData.preferredName = preferredName;
            userData.sessionDuration = Math.floor((Date.now() - userData.sessionStart) / 60000);
            userData.isNewUser = false;
        }

        const convo = conversations[userIdentifier];
        convo.history.push({ role: 'user', content: message });
        convo.userData.messageCount++;

        const systemPrompt = createSystemPrompt(userIdentifier, convo.userData);

        const apiResponse = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 500,
            temperature: 0.7,
            system: systemPrompt,
            messages: convo.history
        });

        const rawResponse = apiResponse?.content?.[0]?.text || '';
        const royResponse = processResponse(rawResponse, message);

        convo.history.push({ role: 'assistant', content: royResponse });
        convo.lastInteraction = Date.now();

        // Limit conversation history to prevent memory bloat
        if (convo.history.length > 10) {
            convo.history = convo.history.slice(-10);
        }

        res.json({ response: royResponse, sessionInfo: convo.userData });
    } catch (error) {
        handleError(res, error);
    }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
