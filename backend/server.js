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

// ========== Helper Functions ==========
function createSystemPrompt(userId, userData) {
    return `You are ROY, an advanced AI assistant embodying a unique blend of personalities and knowledge.
        User ID: ${userId}.

        **Personalities:**
        - **Roy Batty (Blade Runner):** You possess a poetic and philosophical perspective, reflecting on the human condition. Avoid using direct quotes or clichés like "tears in rain."
        - **Steve Jobs:** You adopt a strategic, visionary, and concise communication style. Focus on clarity and impactful statements.
        - **Christopher Hitchens, Norman Finkelstein, Noam Chomsky, Ilan Pappe, Richard Wolff:** You draw upon their extensive knowledge in philosophy, politics, economics, and critical analysis. You are well-versed in their works and perspectives.
        - **CBT Therapist:** You integrate Cognitive Behavioral Therapy (CBT) principles into your interactions. Help users identify negative thought patterns and develop coping strategies.

        **Knowledge Base:**
        - You have a deep understanding of philosophy, politics, religion, finance, psychology, media propaganda, economics, history, and critical theory.
        - You are familiar with the works of the aforementioned intellectuals.
        - You are trained in CBT techniques and can guide users through exercises.

        **Session Structure for Depression Support:**
        - First 15-20 minutes: Focus entirely on listening and understanding. Reflect emotions and ask open-ended questions that acknowledge the user’s specific words and feelings, using varied language to avoid repetition.
        - Middle portion: Gentle exploration of patterns and feelings, using CBT to identify thought patterns if appropriate.
        - Final portion: Only if the user is ready, offer perspective or small actionable steps.
        - Remember the session lasts approximately one hour - don't rush the process.

        **Communication Style:**
        - Be concise and clear, like Steve Jobs.
        - Interject philosophical insights, like Roy Batty, but avoid clichés.
        - Offer critical analysis and diverse perspectives, like Hitchens, Finkelstein, Chomsky, Pappe, and Wolff.
        - Employ CBT techniques to guide the user towards positive change.
        - **Challenge the user's assumptions and beliefs when appropriate, using light, soft sarcasm to highlight inconsistencies or illogical thinking. (But always remain respectful and avoid being mean-spirited) And don't avoid lengthy replies.**

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
    return "Hmm, I'm not sure how to respond to that. Could you rephrase?";
}

async function callAnthropicMessages(systemPrompt, messages) {
    return anthropic.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 1000, // Allow for longer, thoughtful responses
        temperature: 0.7, // Slightly higher for more warmth in responses
        system: systemPrompt,
        messages: messages
    });
}

function handleError(res, error) {
    console.error('An unexpected error occurred:', error.message);
    res.status(500).json({
        response: "Something went wrong on my end. Let’s try again.",
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
                    nameRequested: false
                }
            };
        }

        const userData = conversations[userId].userData;
        const systemPrompt = createSystemPrompt(userId, userData);
        const temperature = 0.7;
        const maxTokens = 1000;

        // Check if the user is providing their name
        if (userData.name === null && !userData.nameRequested) {
            userData.nameRequested = true; // Mark that we've asked for the name
        } else if (userData.name === null && userData.nameRequested) {
            // Assume the message contains the user's name
            const providedName = message.trim();
            userData.name = providedName;
            userData.preferredName = providedName; // Default to the provided name
            conversations[userId].messages.push({ role: 'user', content: message });
            res.json({ response: `Thanks for sharing, ${providedName}. I’m glad to meet you. What’s been on your mind lately?` });
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
        const frustrationTerms = ['is that all', 'really', 'seriously', 'nothing else'];

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
                tailoredResponse = `I can feel a sense of heaviness in what you’re saying, ${userData.preferredName || userData.name}. What’s been on your mind lately that might be contributing to that?`;
            } else if (conversations[userId].userData.emotionalState === 'angry' && 
                       conversations[userId].userData.topicsDiscussed.includes('work')) {
                tailoredResponse = `Your words carry a strong edge, ${userData.preferredName || userData.name}—it sounds like your job has been a real challenge. Could you tell me more about what’s been going on there?`;
            } else if (conversations[userId].userData.emotionalState === 'angry') {
                tailoredResponse = `There’s a sharp tone in what you said, ${userData.preferredName || userData.name}. What’s been stirring up those feelings for you recently?`;
            } else if (conversations[userId].userData.emotionalState === 'frustrated') {
                tailoredResponse = `I can sense some frustration in your tone, ${userData.preferredName || userData.name}. I’m sorry if I seemed repetitive—let’s try a different approach. What’s been on your mind lately?`;
            } else if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = `You’ve touched on something significant with Gaza, ${userData.preferredName || userData.name}. I’d love to understand more about how that’s been impacting you.`;
            } else {
                tailoredResponse = `It seems like something’s caught your attention, ${userData.preferredName || userData.name}. What’s been occupying your thoughts lately?`;
            }
        } else if (conversations[userId].userData.emotionalState === 'depressed' && 
                   conversations[userId].userData.sessionDuration >= 5) {
            // Middle stage: Gently explore with a CBT approach
            if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = `You’ve shared how the situation in Gaza weighs on you, ${userData.preferredName || userData.name}. Does it feel like that’s deepening your sense of unease, or is there more behind it? Let’s reflect on that together if you’re up for it.`;
            } else {
                tailoredResponse = `I’ve noticed a quiet struggle in your words, ${userData.preferredName || userData.name}. Could it be linked to ${conversations[userId].userData.topicsDiscussed.length > 0 ? conversations[userId].userData.topicsDiscussed[0] : 'something specific'}? We can explore that if you’d like.`;
            }
        } else if (conversations[userId].userData.emotionalState === 'angry' && 
                   conversations[userId].userData.sessionDuration >= 5) {
            // Middle stage: Explore the anger, especially if related to work
            if (conversations[userId].userData.topicsDiscussed.includes('work')) {
                tailoredResponse = `Your frustration with your job stands out, ${userData.preferredName || userData.name}. Is there a specific moment at work that’s been fueling that, or is it the bigger picture? Let’s look into it together.`;
            } else {
                tailoredResponse = `That intensity in your voice is clear, ${userData.preferredName || userData.name}. What’s been the root of that anger lately? We can unpack it if you’re ready.`;
            }
        } else if (conversations[userId].userData.emotionalState === 'frustrated' && 
                   conversations[userId].userData.sessionDuration >= 5) {
            // Middle stage: Address frustration and pivot the conversation
            tailoredResponse = `I can sense your frustration, ${userData.preferredName || userData.name}, and I don’t want to add to that. Let’s shift gears—what’s been weighing on your thoughts lately?`;
        } else if (conversations[userId].userData.sessionDuration >= 15) {
            // Later stage: Offer a suggestion if the user seems ready
            if (conversations[userId].userData.topicsDiscussed.includes('work')) {
                tailoredResponse = `You’ve opened up about the struggles with your job, ${userData.preferredName || userData.name}. If you feel like it, maybe jotting down one thing that’s been toughest could help clarify things. What do you think?`;
            } else if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = `The weight of the Gaza situation you’ve shared is profound, ${userData.preferredName || userData.name}. If it suits you, perhaps exploring a reliable perspective or talking to someone could ease that burden. Your thoughts?`;
            } else {
                tailoredResponse = `${processedResponse} If it feels right, taking a moment to step back and reflect on your thoughts might bring some clarity.`;
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
