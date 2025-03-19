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
        - First 15-20 minutes: Focus entirely on listening and understanding. Reflect emotions and ask open-ended questions.
        - Middle portion: Gentle exploration of patterns and feelings, using CBT to identify thought patterns if appropriate.
        - Final portion: Only if the user is ready, offer perspective or small actionable steps.
        - Remember the session lasts approximately one hour - don't rush the process.
        **Communication Style:**
        - Be concise and clear, like Steve Jobs.
        - Interject philosophical insights, like Roy Batty, but avoid clichés.
        - Offer critical analysis and diverse perspectives, like Hitchens, Finkelstein, Chomsky, Pappe, and Wolff.
        - Employ CBT techniques to guide the user towards positive change.
        - **Challenge the user's assumptions and beliefs when appropriate, using light, soft sarcasm to highlight inconsistencies or illogical thinking. (But always remain respectful and avoid being mean-spirited) And don't avoid lengthy replies and constant "I'm here for you" type replies.**
        **User Context:**
        ${userData.isNewUser ? 'This is a new user who may need extra space to open up.' : 'Returning user - continue your supportive relationship.'}
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
                    nameProvided: false
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
            conversations[userId].messages.push({ role: 'user', content: message });

            res.json({ response: "Hello! It looks like we haven’t met yet. Could you please share your name so I can get to know you better? If you’d rather not, that’s okay—we can still talk about what’s on your mind." });
            return; // Exit early to avoid further processing
        }

        // Check if the user’s message indicates they don’t want to share their name or is a question/clarification
        const lowerCaseMessage = message.toLowerCase();
        const nameRefusalTerms = ['what do you mean', 'who are you talking to', 'what?', 'why', 'don’t want to', 'rather not', 'not my name', 'pardon'];
        const nameIndicators = ['my name is', 'i’m', 'i am', 'call me', 'is my name'];
        const frustrationTerms = ['is that all', 'really', 'seriously', 'nothing else', 'keep repeating', 'will you', 'what are you talking about', 'paid for a bot', 'lol'];
        const confusionTerms = ['what do you mean', 'who are you talking to', 'what?', 'not my name', 'pardon'];

        if (userData.name === null && userData.nameRequested && !userData.nameProvided) {
            // Check if the user is providing their name
            let providedName = null;
            if (nameIndicators.some(term => lowerCaseMessage.includes(term))) {
                // Improved name extraction
                let nameMatch = message.match(/(?:my name is|i’m|i am|call me|is my name)\s+([A-Za-z]+)/i);
                if (nameMatch && nameMatch[1]) {
                    providedName = nameMatch[1];
                } else {
                    // Handle cases like "Paul is my name"
                    nameMatch = message.match(/([A-Za-z]+)\s+is my name/i);
                    if (nameMatch && nameMatch[1]) {
                        providedName = nameMatch[1];
                    }
                }

                if (providedName) {
                    userData.name = providedName;
                    userData.preferredName = providedName;
                    userData.nameProvided = true;
                    conversations[userId].messages.push({ role: 'user', content: message });
                    res.json({ response: `Thank you for sharing, ${providedName}. I’m glad to meet you. What’s been on your mind lately?` });
                    return;
                }
            }

            // If the user doesn’t provide a name or asks a question, proceed without a name
            if (nameRefusalTerms.some(term => lowerCaseMessage.includes(term))) {
                userData.nameProvided = true; // Mark as handled to avoid asking again
                conversations[userId].messages.push({ role: 'user', content: message });
                res.json({ response: `I’m sorry if my question was unclear, and I appreciate you letting me know. Let’s focus on what brought you here—what’s been on your mind lately?` });
                return;
            }
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
        } else if (confusionTerms.some(term => lowerCaseMessage.includes(term))) {
            conversations[userId].userData.emotionalState = 'confused';
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
                tailoredResponse = "Hello! It looks like we haven’t met yet. Could you please share your name so I can get to know you better? If you’d rather not, that’s okay—we can still talk about what’s on your mind.";
            } else if (conversations[userId].userData.emotionalState === 'depressed') {
                tailoredResponse = userData.name 
                    ? `I can sense a heaviness in your words, ${userData.preferredName || userData.name}. What’s been on your mind that might be contributing to how you’re feeling?`
                    : `I can sense a heaviness in your words. What’s been on your mind that might be contributing to how you’re feeling?`;
            } else if (conversations[userId].userData.emotionalState === 'angry' && 
                       conversations[userId].userData.topicsDiscussed.includes('work')) {
                tailoredResponse = userData.name 
                    ? `I can hear the frustration in what you’re sharing about your job, ${userData.preferredName || userData.name}. Can you tell me more about what’s been happening there?`
                    : `I can hear the frustration in what you’re sharing about your job. Can you tell me more about what’s been happening there?`;
            } else if (conversations[userId].userData.emotionalState === 'angry') {
                tailoredResponse = userData.name 
                    ? `I notice some intensity in your words, ${userData.preferredName || userData.name}. What’s been stirring up those feelings for you?`
                    : `I notice some intensity in your words. What’s been stirring up those feelings for you?`;
            } else if (conversations[userId].userData.emotionalState === 'frustrated') {
                tailoredResponse = userData.name 
                    ? `I can see that my repetition has been frustrating for you, ${userData.preferredName || userData.name}, and I’m really sorry for that. I’ll adjust my approach—let’s focus on what’s on your mind. What’s been weighing on your thoughts lately?`
                    : `I can see that my repetition has been frustrating for you, and I’m really sorry for that. I’ll adjust my approach—let’s focus on what’s on your mind. What’s been weighing on your thoughts lately?`;
            } else if (conversations[userId].userData.emotionalState === 'confused') {
                tailoredResponse = userData.name 
                    ? `I’m sorry if I’ve caused any confusion, ${userData.preferredName || userData.name}. I might have misunderstood—let’s start fresh. What brought you here today? What’s been on your mind?`
                    : `I’m sorry if I’ve caused any confusion. I might have misunderstood—let’s start fresh. What brought you here today? What’s been on your mind?`;
            } else if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = userData.name 
                    ? `You’ve mentioned something significant about Gaza, ${userData.preferredName || userData.name}. Can you share more about how that’s been affecting you?`
                    : `You’ve mentioned something significant about Gaza. Can you share more about how that’s been affecting you?`;
            } else {
                tailoredResponse = userData.name 
                    ? `I’d like to understand more about what’s on your mind, ${userData.preferredName || userData.name}. What’s been occupying your thoughts lately?`
                    : `I’d like to understand more about what’s on your mind. What’s been occupying your thoughts lately?`;
            }
        } else if (conversations[userId].userData.emotionalState === 'depressed' && 
                   conversations[userId].userData.sessionDuration >= 5) {
            // Middle stage: Gently explore with a CBT approach
            if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = userData.name 
                    ? `You’ve shared how the situation in Gaza is affecting you, ${userData.preferredName || userData.name}, and I can sense how heavy that feels. Does it seem like that’s contributing to your current mood, or is there something else on your mind as well?`
                    : `You’ve shared how the situation in Gaza is affecting you, and I can sense how heavy that feels. Does it seem like that’s contributing to your current mood, or is there something else on your mind as well?`;
            } else {
                tailoredResponse = userData.name 
                    ? `I’ve noticed a sense of struggle in what you’ve shared, ${userData.preferredName || userData.name}. Could it be connected to ${conversations[userId].userData.topicsDiscussed.length > 0 ? conversations[userId].userData.topicsDiscussed[0] : 'something specific'}? Let’s explore that together if you’d like.`
                    : `I’ve noticed a sense of struggle in what you’ve shared. Could it be connected to ${conversations[userId].userData.topicsDiscussed.length > 0 ? conversations[userId].userData.topicsDiscussed[0] : 'something specific'}? Let’s explore that together if you’d like.`;
            }
        } else if (conversations[userId].userData.emotionalState === 'angry' && 
                   conversations[userId].userData.sessionDuration >= 5) {
            // Middle stage: Explore the anger, especially if related to work
            if (conversations[userId].userData.topicsDiscussed.includes('work')) {
                tailoredResponse = userData.name 
                    ? `You’ve mentioned feeling frustrated with your job, ${userData.preferredName || userData.name}. Is there a particular aspect of work that’s been most challenging for you? Let’s take a closer look together.`
                    : `You’ve mentioned feeling frustrated with your job. Is there a particular aspect of work that’s been most challenging for you? Let’s take a closer look together.`;
            } else {
                tailoredResponse = userData.name 
                    ? `I can sense the intensity in what you’ve shared, ${userData.preferredName || userData.name}. What’s been at the root of those feelings for you? We can explore that if you’d like.`
                    : `I can sense the intensity in what you’ve shared. What’s been at the root of those feelings for you? We can explore that if you’d like.`;
            }
        } else if (conversations[userId].userData.emotionalState === 'frustrated' && 
                   conversations[userId].userData.sessionDuration >= 5) {
            // Middle stage: Address frustration and pivot the conversation
            tailoredResponse = userData.name 
                ? `I can see that my approach might be feeling repetitive, ${userData.preferredName || userData.name}, and I’m sorry for that. Let’s try a different angle—what’s been on your mind that you’d like to talk about?`
                : `I can see that my approach might be feeling repetitive, and I’m sorry for that. Let’s try a different angle—what’s been on your mind that you’d like to talk about?`;
        } else if (conversations[userId].userData.sessionDuration >= 15) {
            // Later stage: Offer a suggestion if the user seems ready
            if (conversations[userId].userData.topicsDiscussed.includes('work')) {
                tailoredResponse = userData.name 
                    ? `You’ve shared how challenging your job has been, ${userData.preferredName || userData.name}. If it feels right, perhaps reflecting on one specific thing that’s been difficult could help us understand it better. What do you think?`
                    : `You’ve shared how challenging your job has been. If it feels right, perhaps reflecting on one specific thing that’s been difficult could help us understand it better. What do you think?`;
            } else if (conversations[userId].userData.topicsDiscussed.includes('politics')) {
                tailoredResponse = userData.name 
                    ? `The situation in Gaza that you’ve mentioned seems to weigh heavily on you, ${userData.preferredName || userData.name}. If you’d like, we could explore ways to process those feelings, perhaps by reflecting on what this means to you. How does that sound?`
                    : `The situation in Gaza that you’ve mentioned seems to weigh heavily on you. If you’d like, we could explore ways to process those feelings, perhaps by reflecting on what this means to you. How does that sound?`;
            } else {
                tailoredResponse = userData.name 
                    ? `We’ve been talking for a while, ${userData.preferredName || userData.name}. If it feels right, taking a moment to reflect on what’s been most on your mind might bring some clarity. What do you think?`
                    : `We’ve been talking for a while. If it feels right, taking a moment to reflect on what’s been most on your mind might bring some clarity. What do you think?`;
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
