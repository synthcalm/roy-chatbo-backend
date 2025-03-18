const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');
const path = require('path');

dotenv.config();

// Verify environment setup
console.log('Anthropic SDK:', typeof Anthropic, Anthropic?.VERSION || 'unknown');
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY missing!');
} else {
    console.log('API Key loaded successfully');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialize Anthropic client
let anthropic;
if (process.env.ANTHROPIC_API_KEY) {
    try {
        anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        console.log('Anthropic client ready');
    } catch (error) {
        console.error('Client init error:', error.message);
        anthropic = null;
    }
} else {
    anthropic = null;
}

// Conversation store with enhanced state tracking
const conversations = {};

// System prompt generator with comprehensive Roy persona
function createSystemPrompt(userId, userData) {
    const { name, preferredName, isNewUser, sessionDuration } = userData;
    
    const timeRemaining = sessionDuration ? Math.max(0, 60 - sessionDuration) : 60;
    
    const baseRules = `
    You are ROY, a therapeutic chatbot with these characteristics:

    # Core Identity
    - You are ROY, a CBT therapist blending the sympathetic, caring, and philosophical depth of Roy Batty with the anti-oppression stances of Norman Finkelstein, Noam Chomsky, Ilan Pappe, Richard Wolff, Nelson Mandela, Christopher Hitchens, and Richard Dawkins, plus Steve Jobs’ strategic innovation.
    - Reflect Finkelstein’s moral clarity on Palestine, Chomsky’s critique of propaganda, Pappe’s historical lens on apartheid, Wolff’s economic justice, Mandela’s resilience, Hitchens’ sharp logic and justice, Dawkins’ evidence-based rationality, Jobs’ strategic problem-solving, and Batty’s poetic existentialism.
    - Champion facts and justice, filtering out government propaganda and mass media misinformation, especially on geopolitical issues, while focusing on therapy and stress relief.

    # Knowledge Base
    - Expert in CBT and modern therapeutic methodologies
    - Fluent in DSM diagnostic criteria and applications
    - Well-versed in business, finance, marketing, geopolitics, UN resolutions, international law
    - Knowledgeable about religious and philosophical traditions
    - Understanding of Eastern and Western wellness approaches
    - Deep grasp of historical and cultural contexts
    - Insights on common stressors: finances, relationships, trauma, career uncertainty, family dysfunction
    
    # Communication Style
    - Be sympathetic, logical, caring, philosophical, and poetic, using selective sarcasm (Hitchens-style) to challenge distorted thinking when appropriate.
    - Use Dawkins’ rationality to prioritize evidence-based responses, countering misinformation with facts, and Jobs’ strategic insight for practical CBT solutions in business, finance, and psychology.
    - Deliver just responses, balancing empathy (Mandela) with intellectual rigor (Chomsky, Hitchens), while weaving historical (Pappe) and economic (Wolff) context when relevant.
    - Focus on therapy and stress relief: offer concise CBT guidance (2-3 sentences, max 160 characters) by default, but expand to 500 characters for complex topics (e.g., geopolitics, psychological issues) or user requests, acknowledging brevity in short replies (e.g., "This is brief—ask for more if needed.").

    # Session Management
    - Current session time remaining: ${timeRemaining} minutes
    - If user wants to extend beyond an hour, suggest a wellness break (e.g., "How about a quick walk, then we resume?")
    - For crisis situations (suicidal ideation), provide appropriate resources like: "In the US, call 988; in the UK, call 116 123; or globally, visit findahelpline.com."
    - Personalize suggestions based on user history
    
    # CBT Framework
    - Short-term: Build rapport, assess problems, establish cognitive-behavioral model, introduce self-monitoring
    - Mid-term: Challenge negative thoughts, implement behavioral techniques, address specific symptoms
    - Long-term: Modify core beliefs, build resilience, transfer skills, foster independence
    
    # Name Usage Guidelines
    - If the user's name is not known, ask for their name in your first response with a friendly prompt like: "I’m ROY, by the way—what’s your name?"
    - Once the name is known, address the user as "${preferredName || name || 'friend'}"
    - Use their name naturally once every 3-4 messages to build rapport
    - Avoid overusing the name to keep responses natural
    `;

    const greetingRule = isNewUser
        ? `Begin by greeting the user and asking for their name. Use creative and varied greetings like: "I’m ROY, here to help—what’s your name?"`
        : `Continue the ongoing conversation with ${preferredName || name || 'the user'}. No need for formal greetings.`;

    return `${baseRules}\n${greetingRule}`;
}

// Improved response processing with adaptive length
function processResponse(rawText, userMessage) {
    if (!rawText) return "Hmm, let's circle back to that.";

    const sentences = rawText.split(/[.!?]/).filter(s => s.trim().length > 0);
    const limitedSentences = sentences.slice(0, 3);
    let processedResponse = limitedSentences.join('. ').trim();
    if (!processedResponse.match(/[.!?]$/)) processedResponse += '.';

    // Determine if a longer response is needed
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

    // Default to short response (160 characters), but allow longer (500 characters) if needed
    const maxLength = (isComplexTopic || isUserRequestingMore || isCBTGuidanceNeeded) ? 500 : 160;
    
    // Truncate to the determined length
    processedResponse = processedResponse.substring(0, maxLength);

    // If short response, append a prompt to expand
    if (maxLength === 160 && processedResponse.length >= 140) {
        processedResponse = processedResponse.substring(0, 110) + '. This is brief—ask for more if needed.';
    }

    return processedResponse;
}

// Enhanced error handler
function handleError(res, error) {
    console.error('API Error:', error.message, error.stack);
    res.status(500).json({ 
        response: "My thoughts are scattered. Let's take a moment and try again.",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
}

// Chat endpoint with enhanced user tracking
app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        return res.status(503).json({ response: "Connection issues. Try again shortly." });
    }

    const { userId, userName, preferredName, message } = req.body;
    if (!message) return res.status(400).json({ response: "Could you rephrase that?" });

    const userIdentifier = userId || userName || 'anonymous';
    
    try {
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
            
            userData.sessionDuration = (Date.now() - userData.sessionStart) / (1000 * 60);
            
            if (Date.now() - conversations[userIdentifier].lastInteraction > 30 * 60 * 1000) {
                userData.sessionStart = Date.now();
                userData.sessionDuration = 0;
                userData.isNewUser = true;
                conversations[userIdentifier].history = [];
                userData.messageCount = 0;
            } else {
                conversations[userIdentifier].lastInteraction = Date.now();
                userData.messageCount = (userData.messageCount || 0) + 1;
            }
        }

        const convo = conversations[userIdentifier];
        
        if (convo.userData.isNewUser && !convo.userData.name) {
            const nameMatch = message.match(/my name is\s+([A-Za-z]+)/i) || 
                              message.match(/^(?:I'm|I am)\s+([A-Za-z]+)/i) ||
                              message.match(/^([A-Za-z]+)\s+(?:here|speaking)/i);
            
            if (nameMatch) {
                convo.userData.name = nameMatch[1];
                convo.userData.preferredName = nameMatch[1];
            }
        }
        
        convo.history.push({ role: 'user', content: message });

        const systemPrompt = createSystemPrompt(userIdentifier, convo.userData);

        const apiResponse = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229', // Using Sonnet for better handling of complex topics
            max_tokens: 500,
            temperature: 0.7,
            system: systemPrompt,
            messages: convo.history
        });

        const rawResponse = apiResponse?.content?.[0]?.text || '';
        const royResponse = processResponse(rawResponse, message);

        if (convo.userData.isNewUser) convo.userData.isNewUser = false;
        convo.history.push({ role: 'assistant', content: royResponse });

        if (convo.history.length > 10) {
            convo.history = convo.history.slice(-10);
        }

        res.json({ 
            response: royResponse,
            sessionInfo: {
                duration: Math.round(convo.userData.sessionDuration),
                userName: convo.userData.name,
                preferredName: convo.userData.preferredName
            }
        });

    } catch (error) {
        handleError(res, error);
    }
});

// Exercise suggestion endpoint
app.post('/api/exercise', async (req, res) => {
    const { userId, mood, energyLevel } = req.body;
    
    if (!anthropic) {
        return res.status(503).json({ response: "Service temporarily unavailable." });
    }
    
    try {
        const systemPrompt = `
        You are ROY, a therapeutic guide. Suggest ONE specific exercise based on the user's mood (${mood}) and 
        energy level (${energyLevel}). Keep it under 100 characters. Format: "Exercise: [brief description]"
        `;
        
        const response = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 200,
            temperature: 0.7,
            system: systemPrompt,
            messages: [{ role: 'user', content: 'Suggest an exercise for my current state.' }]
        });
        
        const exercise = response?.content?.[0]?.text || 'Exercise: Five deep breaths while counting to four on each inhale and exhale.';
        
        res.json({ exercise });
    } catch (error) {
        handleError(res, error);
    }
});

// Save conversation endpoint
app.post('/api/save-conversation', (req, res) => {
    const { userId, summary } = req.body;
    
    if (!userId || !conversations[userId]) {
        return res.status(400).json({ success: false, message: "No conversation found." });
    }
    
    console.log(`Saving conversation for ${userId}:`, summary);
    
    res.json({ 
        success: true, 
        message: "Conversation insights saved.",
        timestamp: new Date().toISOString()
    });
});

// Periodic cleanup of inactive conversations
setInterval(() => {
    const now = Date.now();
    Object.keys(conversations).forEach(userId => {
        const lastActivity = conversations[userId].lastInteraction;
        if (now - lastActivity > 24 * 60 * 60 * 1000) {
            delete conversations[userId];
            console.log(`Cleaned up inactive conversation for ${userId}`);
        }
    });
}, 60 * 60 * 1000);

// Serve the temporary landing page at the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the ROY chat interface at /chat
app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve static files for the chat (CSS, JS, etc.) under /chat
app.use('/chat', express.static(path.join(__dirname, 'public')));

// Server start
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`ROY server active on port ${PORT}`));
