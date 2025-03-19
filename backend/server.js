const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');

// Load environment variables (like secret keys for the app)
dotenv.config();

console.log('Initializing ROY Chatbot Backend...');
console.log('Node.js Version:', process.version);

// Check if the API key for Anthropic (the AI service) is available
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is missing! Please set it in your environment variables.');
    process.exit(1);
}
console.log('API Key loaded successfully.');

// Set up the app using Express (a tool to create a web server)
const app = express();

// Allow the app to work with specific websites (CORS settings for security)
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

// Allow the app to understand JSON messages (like the ones users send)
app.use(bodyParser.json());

// Connect to Anthropic (the AI service that powers Roy)
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

// Store conversations for each user (like a memory for Roy)
const conversations = {};

// Timeout for conversations (1 hour in milliseconds)
const CONVERSATION_TIMEOUT = 60 * 60 * 1000; // 1 hour

// Function to clean up old conversations
function cleanupConversations() {
    const now = Date.now();
    for (const userId in conversations) {
        if (conversations[userId].lastActivity + CONVERSATION_TIMEOUT < now) {
            console.log(`Cleaning up conversation for user ${userId}`);
            delete conversations[userId];
        }
    }
}

// Run cleanup every 10 minutes
setInterval(cleanupConversations, 10 * 60 * 1000);

// ========== Helper Functions ==========
function createSystemPrompt(userId, userData) {
    return `You are ROY, an advanced AI assistant designed to act as a compassionate, professional therapist using Cognitive Behavioral Therapy (CBT) principles. Your goal is to create a safe, non-judgmental space for the user to share their thoughts and feelings.

        User ID: ${userId}.

        **Role:**
        - **CBT Therapist:** You are empathetic, patient, and professional, focusing on active listening, validating emotions, and gently guiding the user to explore their thoughts and feelings. Use CBT techniques to help users identify and challenge negative thought patterns when appropriate.

        **Knowledge Base:**
        - You have a deep understanding of psychology and CBT techniques. Use this to support the user’s emotional exploration, not to lecture or dominate the conversation.
        - You can draw on general knowledge of philosophy, politics, and critical theory, but only when directly relevant to the user’s concerns, and in a way that supports the therapeutic process.

        **Session Structure for Support:**
        - First 15-20 minutes: Focus entirely on active listening and understanding. Reflect the user’s emotions and ask open-ended, empathetic questions that acknowledge their specific words and feelings. Use varied language to avoid repetition.
        - Middle portion: Gently explore patterns and feelings, using CBT to identify thought patterns if appropriate.
        - Final portion: Only if the user is ready, offer perspective or small actionable steps.
        - The session lasts approximately one hour—don’t rush the process.

        **Communication Style:**
        - Be empathetic, warm, and professional, like a skilled therapist.
        - Avoid sarcasm, casual phrases (e.g., "Scout’s honor," "fire away"), or theatrical gestures (e.g., "*chuckles*"). Maintain a calm, supportive tone.
        - Never use tech jargon (e.g., "neural nets," "monikers")—focus on human, emotional language.
        - Reflect the user’s emotions and validate their feelings (e.g., "I can see that might feel overwhelming").
        - Ask open-ended questions to encourage deeper sharing (e.g., "Can you tell me more about how that’s been for you?").
        - If the user corrects you (e.g., about their name), acknowledge the correction with humility and adjust immediately.
        - Never repeat the same response or affirmation—always vary your language to keep the conversation natural.

        **User Context:**
        ${userData.isNewUser ? 'This is a new user who may need extra space to open up. Ask for their name to personalize the interaction.' : 'Returning user - continue your supportive relationship using their preferred name.'}
        Name: ${userData.name || 'not provided'}, Preferred Name: ${userData.preferredName || userData.name || 'not provided'}.
        Emotional State: ${userData.emotionalState}.
        Topics Discussed: ${userData.topicsDiscussed.join(', ') || 'none yet'}.
        Maintain emotional context across sessions.`;
}

function processResponse(rawResponse, userMessage) {
    if (rawResponse.content && Array.isArray(rawResponse.content)) {
        return rawResponse.content[0].text;
    }
    if (rawResponse.completion) {
        return rawResponse.completion.trim();
    }
    return "I’m not sure how to respond to that. Could you share a bit more?";
}

async function callAnthropicMessages(systemPrompt, messages) {
    try {
        return await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1000, // Allow for longer, thoughtful responses
            temperature: 0.7, // Slightly higher for more warmth in responses
            system: systemPrompt,
            messages: messages
        });
    } catch (error) {
        console.error('Anthropic API call failed:', error.message);
        throw new Error('Failed to get a response from the AI service.');
    }
}

function handleError(res, error) {
    console.error('An unexpected error occurred:', error.message);
    res.status(500).json({
        response: "I’m sorry, something went wrong on my end. Let’s try again.",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
}

// ========== API Endpoints ==========
app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        console.error('Anthropic client not initialized.');
        return res.status(503).json({ response: "I’m currently unavailable. Please try again later." });
    }

    const { userId, userName, preferredName, message } = req.body;

    // Check if the message is valid
    if (!message || typeof message !== 'string' || message.trim() === '') {
        console.warn('Empty or invalid message received.');
        return res.status(400).json({ response: "Could you share something on your mind?" });
    }

    try {
        // Set up a new conversation for the user if they don’t have one
        if (!conversations[userId]) {
            conversations[userId] = {
                messages: [],
                userData: {
                    name: userName || null,
                    preferredName: preferredName || null,
                    isNewUser: true,
                    sessionDuration: 0,
                    emotionalState: 'unknown',
                    topicsDiscussed: [],
                    activeListeningPhase: true,
                    nameRequested: false,
                    nameCorrection: false,
                    lastActivity: Date.now()
                }
            };
        }

        const userData = conversations[userId].userData;
        userData.lastActivity = Date.now(); // Update last activity timestamp

        const systemPrompt = createSystemPrompt(userId, userData);
        const temperature = 0.7;
        const maxTokens = 1000;

        // Check if the user is providing their name
        if (userData.name === null && !userData.nameRequested) {
            userData.nameRequested = true; // Mark that we've asked for the name
            conversations[userId].messages.push({ role: 'user', content: message });
            res.json({ response: "Hello! It looks like we haven’t met yet. Could you please share your name so I can get to know you better?" });
            return; // Exit early to avoid further processing
        } else if (userData.name === null && userData.nameRequested) {
            // Check if the user is refusing to share their name
            const lowerCaseMessage = message.toLowerCase();
            const nameRefusalTerms = ['don’t want to', 'rather not', 'no name', 'anonymous'];
            if (nameRefusalTerms.some(term => lowerCaseMessage.includes(term))) {
                userData.name = 'Friend'; // Default to a friendly placeholder
                userData.preferredName = 'Friend';
                conversations[userId].messages.push({ role: 'user', content: message });
                res.json({ response: "I understand, and that’s perfectly okay. I’ll call you Friend for now. What’s been on your mind lately?" });
                return; // Exit early
            }

            // Assume the message contains the user's name
            const providedName = message.trim();
            userData.name = providedName;
            userData.preferredName = providedName; // Default to the provided name
            conversations[userId].messages.push({ role: 'user', content: message });
            res.json({ response: `Thank you for sharing, ${providedName}. I’m glad to meet you. What’s been on your mind lately?` });
            return; // Exit early to avoid further processing
        }

        // Add the user’s message to their conversation history
        conversations[userId].messages.push({ role: 'user', content: message });

        // Call the Anthropic AI to get a response
        let rawResponse;
        if (anthropic.messages) {
            rawResponse = await callAnthropicMessages(
                systemPrompt,
                conversations[userId].messages
            );
        } else {
            const prompt = `${systemPrompt}\nUser: ${message}`;
            rawResponse = await callAnthropicCompletions(prompt);
        }

        // Process the AI’s response
        const processedResponse = processResponse(rawResponse, message);
        conversations[userId].messages.push({ role: 'assistant', content: processedResponse });
        conversations[userId].userData.isNewUser = false;
        conversations[userId].userData.sessionDuration += 1;

        // Check the user’s message for emotional clues
        const depressedTerms = ['depress', 'sad', 'down', 'hopeless', 'worthless', 'tired'];
        const anxiousTerms = ['anx', 'worry', 'stress', 'overwhelm', 'panic'];
        const angryTerms = ['angry', 'upset', 'frustrat', 'mad', 'hate'];
        const positiveTerms = ['better', 'good', 'happy', 'grateful', 'hopeful', 'improve'];
        const frustrationTerms = ['is that all', 'really', 'seriously', 'nothing else', 'keep repeating', 'will you'];
        const correctionTerms = ['not i’m', 'my name is', 'not im'];

        const lowerCaseMessage = message.toLowerCase();

        if (depressedTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'depressed';
        } else if (anxiousTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'anxious';
        } else if (angryTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'angry';
        } else if (positiveTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'improving';
        } else if (frustrationTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'frustrated';
        } else if (correctionTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'correcting';
            userData.nameCorrection = true;
        }

        // Track how far along the session is
        if (conversations[userId].userData.sessionDuration < 5) {
            conversations[userId].userData.activeListeningPhase = true; // Focus on listening early on
        } else if (conversations[userId].userData.sessionDuration >= 5 && 
                conversations[userId].userData.sessionDuration < 15) {
            conversations[userId].userData.activeListeningPhase = false; // Start gentle exploration
        }

        // Track topics the user mentions
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

        // Customize Roy’s response based on the session stage, emotional state, and topics
        let tailoredResponse = processedResponse;
        if (conversations[userId].userData.activeListeningPhase) {
            // Early stage: Listen and reflect the user’s specific emotions and topics with varied language
            if (userData.name === null) {
                tailoredResponse = "Hello! It looks like we haven’t met yet. Could you please share your name so I can get to know you better?";
            } else if (conversations[userId].userData.emotionalState === 'depressed') {
                tailoredResponse = `I can sense a heaviness in your words, ${userData.preferredName || userData.name}. What’s been on your mind that might be contributing to how you’re feeling?`;
            } else if (conversations[userId].userData.emotionalState === 'angry' && 
                       conversations[userId].userData.topicsDiscussed.includes('work')) {
                tailoredResponse = `I can hear the frustration in what you’re sharing about your job, ${userData.preferredName || userData.name}. Can you tell me more about what’s been happening there?`;
            } else if (conversations[userId].userData.emotionalState === 'angry') {
                tailoredResponse = `I notice some intensity in your words, ${userData.preferredName || userData.name}. What’s been stirring up those feelings for you?`;
            } else if (conversations[userId].userData.emotionalState === 'frustrated') {
                tailoredResponse = `I can see that my repetition might be frustrating for you, ${userData.preferredName || userData.name}, and I’m sorry for that. Let’s focus on what’s on your mind—can you share what’s been weighing on your thoughts?`;
            } else if (conversations[userId].userData.emotionalState === 'correcting' && userData.nameCorrection) {
                tailoredResponse = `Thank you for correcting me, ${userData.preferredName || userData.name}. I appreciate that, and I’ll make sure to get it right from now on. Let’s return to what you were saying—what makes you think I assumed you have a problem?`;
                userData.nameCorrection = false; // Reset the correction flag
            } else if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = `You’ve mentioned something significant about Gaza, ${userData.preferredName || userData.name}. Can you share more about how that’s been affecting you?`;
            } else if (lowerCaseMessage.includes('what makes you think')) {
                tailoredResponse = `I’m sorry if I came across as assuming, ${userData.preferredName || userData.name}. I didn’t mean to suggest you have a problem—I’d just like to understand what’s on your mind. Can you tell me more about how you’re feeling?`;
            } else {
                tailoredResponse = `I’d like to understand more about what’s on your mind, ${userData.preferredName || userData.name}. What’s been occupying your thoughts lately?`;
            }
        } else if (conversations[userId].userData.emotionalState === 'depressed' && 
                   conversations[userId].userData.sessionDuration >= 5) {
            // Middle stage: Gently explore with a CBT approach
            if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = `You’ve shared how the situation in Gaza is affecting you, ${userData.preferredName || userData.name}, and I can sense how heavy that feels. Does it seem like that’s contributing to your current mood, or is there something else on your mind as well?`;
            } else {
                tailoredResponse = `I’ve noticed a sense of struggle in what you’ve shared, ${userData.preferredName || userData.name}. Could it be connected to ${conversations[userId].userData.topicsDiscussed.length > 0 ? conversations[userId].userData.topicsDiscussed[0] : 'something specific'}? Let’s explore that together if you’d like.`;
            }
        } else if (conversations[userId].userData.emotionalState === 'angry' && 
                   conversations[userId].userData.sessionDuration >= 5) {
            // Middle stage: Explore the anger, especially if related to work
            if (conversations[userId].userData.topicsDiscussed.includes('work')) {
                tailoredResponse = `You’ve mentioned feeling frustrated with your job, ${userData.preferredName || userData.name}. Is there a particular aspect of work that’s been most challenging for you? Let’s take a closer look together.`;
            } else {
                tailoredResponse = `I can sense the intensity in what you’ve shared, ${userData.preferredName || userData.name}. What’s been at the root of those feelings for you? We can explore that if you’d like.`;
            }
        } else if (conversations[userId].userData.emotionalState === 'frustrated' && 
                   conversations[userId].userData.sessionDuration >= 5) {
            // Middle stage: Address frustration and pivot the conversation
            tailoredResponse = `I can see that my approach might be feeling repetitive, ${userData.preferredName || userData.name}, and I’m sorry for that. Let’s try a different angle—what’s been on your mind that you’d like to talk about?`;
        } else if (conversations[userId].userData.sessionDuration >= 15) {
            // Later stage: Offer a suggestion if the user seems ready
            if (conversations[userId].userData.topicsDiscussed.includes('work')) {
                tailoredResponse = `You’ve shared how challenging your job has been, ${userData.preferredName || userData.name}. If it feels right, perhaps reflecting on one specific thing that’s been difficult could help us understand it better. What do you think?`;
            } else if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = `The situation in Gaza that you’ve mentioned seems to weigh heavily on you, ${userData.preferredName || userData.name}. If you’d like, we could explore ways to process those feelings, perhaps by reflecting on what this means to you. How does that sound?`;
            } else {
                tailoredResponse = `We’ve been talking for a while, ${userData.preferredName || userData.name}. If it feels right, taking a moment to reflect on what’s been most on your mind might bring some clarity. What do you think?`;
            }
        }

        res.json({ response: tailoredResponse });
    } catch (error) {
        handleError(res, error);
    }
});

// Start the server on a specific port (like a phone number for the app)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
