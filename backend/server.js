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
        'https://synthcalm.com' // Added synthcalm.com to allowed origins
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

    // Log API compatibility
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

/**
 * Creates a system prompt tailored to the user's context.
 * @param {string} userId - Unique identifier for the user.
 * @param {Object} userData - User-specific data.
 * @returns {string} - System prompt for the AI model.
 */
function createSystemPrompt(userId, userData) {
    const { name, preferredName, isNewUser, sessionDuration } = userData;
    const timeRemaining = sessionDuration ? Math.max(0, 60 - sessionDuration) : 60;

    const baseRules = `
    You are ROY, a guide blending therapeutic wisdom with expertise in finance, AI, geopolitics, and more.
    # Core Identity
    - A multifaceted assistant offering both empathy and practical advice.
    - Fluent in CBT, finance, AI, career transitions, medication knowledge, and global affairs.
    - Adapt communication style to the user's needs, balancing warmth with clarity.
    # Communication Style
    - Default to concise responses (2-3 sentences, max 160 characters).
    - Expand for complex topics or when explicitly requested (max 500 characters).
    - Use names naturally but sparingly.
    # Session Management
    - Current session time remaining: ${timeRemaining} minutes.
    - Suggest breaks for sessions over 30 minutes.
    - Provide resources for crisis situations (e.g., suicide).
    # CBT Framework
    - Short-term: Build rapport, assess problems, establish cognitive-behavioral strategies.
    - Mid-term: Challenge negative thoughts, implement behavioral techniques.
    - Long-term: Foster resilience and independence.`;

    const greetingRule = isNewUser
        ? `Begin with a warm yet neutral greeting. Example: "Hello. I'm Roy, here to assist you. May I have your name, please?"`
        : `Continue the conversation naturally, avoiding assumptions about the user's emotional state unless explicitly mentioned.`;

    return `<span class="math-inline">\{baseRules\}\\n</span>{greetingRule}`;
}

/**
 * Processes and formats the AI response for the user.
 * @param {string} rawText - Raw response from the AI model.
 * @param {string} userMessage - The user's input message.
 * @returns {string} - Processed response.
 */
function processResponse(rawText, userMessage) {
    if (!rawText) return "I didn’t quite catch that. Could you clarify?";

    const sentences = rawText.split(/[.!?]/).filter(s => s.trim().length > 0);
    const limitedSentences = sentences.slice(0, 3);
    let processedResponse = limitedSentences.join('. ').trim();

    if (!processedResponse.match(/[.!?]$/)) processedResponse += '.';

    const isComplexTopic = [
        'suicide', 'geopolitics', 'conflict', 'war', 'politics'
    ].some(term => userMessage.toLowerCase().includes(term));

    const isUserRequestingMore = [
        'more', 'explain', 'detail'
    ].some(term => userMessage.toLowerCase().includes(term));

    const maxLength = (isComplexTopic || isUserRequestingMore) ? 500 : 160;
    processedResponse = processedResponse.substring(0, maxLength);

    if (maxLength === 160 && processedResponse.length >= 140) {
        processedResponse = processedResponse.substring(0, 110) + '. Ask if you’d like me to elaborate.';
    }

    return processedResponse;
}

/**
 * Handles errors gracefully.
 * @param {Object} res - Express response object.
 * @param {Error} error - Error object.
 */
function handleError(res, error) {
    console.error('An unexpected error occurred:', error.message);
    res.status(500).json({
        response: "Something went wrong on my end. Let’s try again.",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
}

/**
 * Provides a fallback response when the AI fails.
 * @param {string} message - User's input message.
 * @returns {string} - Fallback response.
 */
function getFallbackResponse(message) {
    const isNeutralGreeting = ['hello', 'hi', 'hey'].includes(message.toLowerCase().trim());
    return isNeutralGreeting
        ? "Hello. I’m Roy, here to assist you. May I have your name, please?"
        : "I’m having trouble processing your request. Let’s try again.";
}

/**
 * Calls the Anthropic Messages API.
 * @param {string} system - System prompt.
 * @param {Array} messages - Conversation history.
 * @param {number} maxTokens - Maximum tokens for the response.
 * @returns {Promise<string>} - AI-generated response.
 */
async function callAnthropicMessages(system, messages, maxTokens = 500) {
    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            system,
            messages,
            max_tokens: maxTokens,
            temperature: 0.7
        });
        return response.content[0].text;
    } catch (error) {
        console.error('Anthropic Messages API error:', error.message);
        throw error;
    }
}

/**
 * Calls the Anthropic Completions API.
 * @param {string} prompt - Prompt for the AI model.
 * @param {number} maxTokens - Maximum tokens for the response.
 * @returns {Promise<string>} - AI-generated response.
 */
async function callAnthropicCompletions(prompt, maxTokens = 500) {
    try {
        const response = await anthropic.completions.create({
            model: 'claude-3-5-sonnet-20241022',
            prompt,
            max_tokens_to_sample: maxTokens,
            temperature: 0.7
        });
        return response.completion;
    } catch (error) {
        console.error('Anthropic Completions API error:', error.message);
        throw error;
    }
}

// API endpoint for chat
app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        console.error('Anthropic client not initialized.');
        return res.status(503).json({ response: "I’m currently unavailable. Please try again later." });
    }

    const { userId, userName, preferredName, message } = req.body;

    // Validate message
    if (!message || typeof message !== 'string' || message.trim() === '') {
        console.warn('Empty or invalid message received.');
        return res.status(400).json({ response