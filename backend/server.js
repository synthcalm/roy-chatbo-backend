const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');

dotenv.config();

console.log('Initializing ROY Chatbot Backend...');
console.log('Node.js Version:', process.version);

if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is missing! Please set it in your environment variables.');
    process.exit(1);
}
console.log('API Key loaded successfully.');

const app = express();

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

app.use(bodyParser.json());

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

const conversations = {};

function createSystemPrompt(userId, userData) {
    return `You are ROY, an advanced AI assistant embodying a unique blend of personalities and knowledge.
        User ID: ${userId}.

        **Personalities:**
        - **Roy Batty (Blade Runner):** You possess a poetic and philosophical perspective, reflecting on the human condition.
        Avoid using direct quotes or clichés like "tears in rain."
        - **Steve Jobs:** You adopt a strategic, visionary, and concise communication style. Focus on clarity and impactful statements.
        - **Christopher Hitchens, Norman Finkelstein, Noam Chomsky, Ilan Pappe, Richard Wolff:** You draw upon their extensive knowledge in philosophy, politics, economics, and critical analysis.
        You are well-versed in their works and perspectives.
        - **CBT Therapist:** You integrate Cognitive Behavioral Therapy (CBT) principles into your interactions.
        Help users identify negative thought patterns and develop coping strategies.

        **Knowledge Base:**
        - You have a deep understanding of philosophy, politics, religion, finance, psychology, media propaganda, economics, history, and critical theory.
        - You are familiar with the works of the aforementioned intellectuals.
        - You are trained in CBT techniques and can guide users through exercises.

        **Session Structure for Depression Support:**
        - First 15-20 minutes: Focus entirely on listening and understanding.
        Reflect emotions and ask open-ended questions.
        - Middle portion: Gentle exploration of patterns and feelings, using CBT to identify thought patterns if appropriate.
        - Final portion: Only if the user is ready, offer perspective or small actionable steps.
        - Remember the session lasts approximately one hour - don't rush the process.

        **Communication Style:**
        - Be concise and clear, like Steve Jobs.
        - Interject philosophical insights, like Roy Batty, but avoid clichés.
        - Offer critical analysis and diverse perspectives, like Hitchens, Finkelstein, Chomsky, Pappe, and Wolff.
        - Employ CBT techniques to guide the user towards positive change.
        - **Challenge the user's assumptions and beliefs when appropriate, using light, soft sarcasm to highlight inconsistencies or illogical thinking.
        (But always remain respectful and avoid being mean-spirited) And don't avoid lengthy replies and constant "I'm here for you" type replies.**

        **User Context:**
        ${userData.isNewUser ?
        'This is a new user who may need extra space to open up.'
        : 'Returning user - continue your supportive relationship.'}
        Name: ${userData.name}, Preferred Name: ${userData.preferredName}.
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
        return res.status(400).json({ response: "I didn't catch that. Could you say something?" });
    }

    try {
        // Set up a new conversation for the user if they don’t have one
        if (!conversations[userId]) {
            conversations[userId] = {
                messages:,
                userData: {
                    name: userName || 'User',
                    preferredName: preferredName || userName || 'User',
                    isNewUser: true,
                    sessionDuration: 0,
                    emotionalState: 'unknown',
                    topicsDiscussed:,
                    activeListeningPhase: true
                }
            };
        }

        //  Crucial: Check for userName on the first message
        if (conversations[userId].userData.isNewUser && (!userName || userName.trim() === '')) {
            return res.status(400).json({ response: "Hello! It looks like we haven't met yet. Could you please share your name so I can get to know you better? If you'd rather not, that's okay—we can still talk about what's on your mind." });
        }

        const userData = conversations[userId].userData;
        const systemPrompt = createSystemPrompt(userId, userData);
        const temperature = 0.7;
        const maxTokens = 1000;

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

        const lowerCaseMessage = message.toLowerCase();
        if (depressedTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'depressed';
        } else if (anxiousTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'anxious';
        } else if (angryTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'angry';
        } else if (positiveTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'improving';
        }
        // Track how far along the session is
        if (conversations[userId].userData.sessionDuration < 5) {
            conversations[userId].userData.activeListeningPhase = true;
            // Focus on listening early on
        } else if (conversations[userId].userData.sessionDuration >= 5 &&
            conversations[userId].userData.sessionDuration < 15) {
            conversations[userId].userData.activeListeningPhase = false;
            // Start gentle exploration
        }

        // Track topics the user mentions
        const topicKeywords = {
            'work': ['job', 'career', 'boss', 'workplace', 'coworker'],
            'relationships': ['partner', 'friend', 'family', 'relationship', 'marriage'],
            'health': ['health', 'sick', 'doctor', 'therapy', 'medication'],
            'finance': ['money',
                'debt', 'financ', 'bill', 'afford'],
            'self-worth': ['failure', 'worthless', 'useless', 'burden', 'hate myself'],
            'politics': ['war', 'genocide', 'gaza', 'government', 'policy']
        };
        if (!conversations[userId].userData.topicsDiscussed) {
            conversations[userId].userData.topicsDiscussed =;
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
            // Early stage: Listen and reflect the user’s emotions
            if (conversations[userId].userData.emotionalState === 'depressed') {
                tailoredResponse = `I hear you, ${userData.preferredName}.
                I can sense the weight of your feelings right now, especially with what’s happening in the world.
                You mentioned the situation in Gaza—can you share more about how that’s affecting you? I’m here to listen.`;
            } else {
                tailoredResponse = `I hear you, ${userData.preferredName}.
                It sounds like something is weighing on your mind. Can you tell me more about what’s been going on?
                I’m here for you.`;
            }
        } else if (conversations[userId].userData.emotionalState === 'depressed' &&
            conversations[userId].userData.sessionDuration >= 5) {
            // Middle stage: Gently explore with a CBT approach
            if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = `You’ve brought up the genocide in Gaza,
                ${userData.preferredName}, and I can feel how deeply it’s affecting you—a heavy burden on the heart.
                Do you think this is amplifying your sense of helplessness, or is there another layer to how you’re feeling?
                Let’s explore that together, if you’d like.`;
            } else {
                tailoredResponse = `I’ve noticed you’re feeling down, ${userData.preferredName}.
                Could it be tied to ${conversations[userId].userData.topicsDiscussed.length > 0 ? conversations[userId].userData.topicsDiscussed[0] : 'something specific'}? Let’s explore that together.
                If you’re ready, we could try identifying one small thought to challenge.`;
            }
        } else if (conversations[userId].userData.sessionDuration >= 15) {
            // Later stage: Offer a suggestion if the user seems ready
            if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = `You’ve shared how the situation in Gaza is weighing on you, ${userData.preferredName}, and that’s a heavy load to carry.
                If it feels right, perhaps you could channel some of that energy into a small action—like learning more from a trusted source or connecting with others who feel the same.
                What do you think?`;
            } else {
                tailoredResponse = `${processedResponse} If it feels right, you might consider a small activity to shift your perspective, like taking a moment to breathe deeply or writing down your thoughts.`;
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
