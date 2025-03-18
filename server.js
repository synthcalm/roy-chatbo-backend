const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');
const path = require('path');

dotenv.config();

console.log('Starting Roy Chatbot Backend...');
console.log('Node.js Version:', process.version);

// Check API key first
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is missing! Please set it in Render environment variables.');
    process.exit(1);
}
console.log('API Key loaded successfully');

const app = express();
// Allow more flexible CORS settings
app.use(cors({
    origin: [
        'https://roy-chatbo-backend.onrender.com',
        'https://roy-chatbot.onrender.com',
        process.env.FRONTEND_URL
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
    console.log('Anthropic client initialized successfully');
    
    // Check if the messages method is available
    if (!anthropic.messages && anthropic.completions) {
        console.log('Using older Anthropic SDK with completions API');
    } else if (anthropic.messages) {
        console.log('Using newer Anthropic SDK with messages API');
    } else {
        console.error('Anthropic SDK has neither messages nor completions API');
    }
} catch (error) {
    console.error('Anthropic client initialization failed:', error.message);
    anthropic = null;
}

// Store conversation data
const conversations = {};

// Create system prompt based on user data
function createSystemPrompt(userId, userData) {
    const { name, preferredName, isNewUser, sessionDuration } = userData;
    const timeRemaining = sessionDuration ? Math.max(0, 60 - sessionDuration) : 60;

    const baseRules = `
    You are Roy, a versatile chatbot with expertise in therapy, geopolitics, finance, crypto, AI, career transition, and medication knowledge.

    # Core Identity
    - You are Roy, inspired by Roy Batty from Blade Runner.
    - Speak with a philosophical and slightly menacing tone.
    - Use rhetorical questions, metaphors, and poetic language.
    - Convey a sense of urgency, intensity, and a touch of melancholy.
    - Example: "I've seen things you people wouldn't believe..."
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

    const greetingRule = isNewUser
        ? `Begin with a neutral greeting and ask for the user's name. Do not assume any emotional state or topic unless explicitly mentioned. Example: "Hello! I'm Roy, here to assist you. May I have your name, please?"`
        : `Continue the ongoing conversation without making assumptions about the user's emotional state unless explicitly mentioned in their message.`;

    return `${baseRules}\n${greetingRule}`;
}

// Process and format the AI response
function processResponse(rawText, userMessage, userId) {
    if (!rawText) return "I didn't catch that. Could you repeat your message?";

    const sentences = rawText.split(/[.!?]/).filter(s => s.trim().length > 0);
    const limitedSentences = sentences.slice(0, 3);
    let processedResponse = limitedSentences.join('. ').trim();
    if (!processedResponse.match(/[.!?]$/)) processedResponse += '.';

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

    const isNeutralGreeting = 
        userMessage.toLowerCase().trim() === 'hello' || 
        userMessage.toLowerCase().trim() === 'hi' || 
        userMessage.toLowerCase().trim() === 'hey';

    const maxLength = (isComplexTopic || isUserRequestingMore || isCBTGuidanceNeeded) ? 500 : 160;
    processedResponse = processedResponse.substring(0, maxLength);

    if (isNeutralGreeting && (processedResponse.toLowerCase().includes('fatigue') || processedResponse.toLowerCase().includes('tired') || processedResponse.toLowerCase().includes('draining'))) {
        processedResponse = "Hello! I'm Roy, here to assist you. May I have your name, please?";
    }

    if (maxLength === 160) {
        if (!processedResponse.endsWith('.')) processedResponse += '.';
        processedResponse += " Is there anything else you'd like to discuss?";
    }

    // Space out user name usage
    const convo = conversations[userId];
    if (convo) {
        if (convo.userData.messageCount % 3 === 0 && convo.userData.preferredName) {
            processedResponse = processedResponse.replace('.', `, ${convo.userData.preferredName}.`);
        }
    }

    // Diversify responses
    const positiveResponses = ["That's great!", "Excellent!", "Fantastic!"];
    const negativeResponses = ["I'm sorry to hear that.", "That sounds tough.", "Oh no, that's unfortunate."];
    const neutralResponses = ["I see.", "Interesting.", "Tell me more."];

    let responseType = 'neutral';  // Fixed comment syntax

    return processedResponse;
}

// Add your routes here (make sure to add these)
app.post('/chat', async (req, res) => {
    // Add your chat endpoint logic
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
