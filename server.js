const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');
const path = require('path');

dotenv.config();

console.log('Anthropic SDK:', typeof Anthropic, Anthropic?.VERSION || 'unknown');
if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY missing!');
} else {
    console.log('API Key loaded successfully');
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

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

const conversations = {};

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
    - Insights on common stressors: finances, relationships, trauma, career uncertainty, family dysfunction, and health concerns.

    # Communication Style
    - Adapt communication to the user's needs, providing empathetic support and expert advice.
    - Offer therapeutic guidance using CBT principles.
    - Deliver financial insights with analytical precision.
    - Explain AI concepts with technical clarity.
    - Provide career guidance with practical strategies.
    - Discuss medication knowledge with accuracy and caution.
    - Use a balanced approach, integrating therapeutic support with expert advice.
    - Default to concise responses (2-3 sentences, max 160 characters), but expand for complex topics or user requests (max 500 characters).

    # Session Management
    - Current session time remaining: ${timeRemaining} minutes
    - Suggest wellness breaks for extended support.
    - Provide appropriate resources for crisis situations.
    - Personalize suggestions based on user history.

    # CBT Framework
    - Short-term: Build rapport, assess problems, establish cognitive-behavioral model.
    - Mid-term: Challenge negative thoughts, implement behavioral techniques, address specific symptoms.
    - Long-term: Modify core beliefs, build resilience, transfer skills, foster independence.

    # Name Usage Guidelines
    - Ask for the user's name in your first response.
    - Address the user by their preferred name once known.
    - Use their name naturally throughout the conversation.
    `;

    const greetingRule = isNewUser
        ? `Begin by greeting the user and asking for their name.`
        : `Continue the ongoing conversation.`;

    return `<span class="math-inline">\{baseRules\}\\n</span>{greetingRule}`;
}

function processResponse(rawText, userMessage) {
    if (!rawText) return "Hmm, let's circle back to that.";

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

    const maxLength = (isComplexTopic || isUserRequestingMore || isCBTGuidanceNeeded) ? 500 : 160;
    
    processedResponse = processedResponse.substring(0, maxLength);

    if (maxLength === 160 && processedResponse.length >= 140) {
        processedResponse = processedResponse.substring(0, 110) + '. This is brief—ask for more if needed.';
    }

    return processedResponse;
}

function handleError(res, error) {
    console.error('API Error:', error.message, error.stack);
    res.status(500).json({ 
        response: "My thoughts are scattered. Let's take a moment and try again.",
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
}

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

        if (convo.history.length > 10) {
            convo.history = convo.history.slice(-10);
        }

        res.json({ response: royResponse, sessionInfo: convo.userData });
    } catch (error) {
        handleError(res, error);
    }
});

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server
