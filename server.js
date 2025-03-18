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

// Conversation store with state tracking
const conversations = {};

// System prompt generator
function createSystemPrompt(userName, needsGreeting) {
    const baseRules = `
        You are ROY. Follow these rules:
        1. Respond in 2~3 short sentences max
        2. Use ${userName}'s after asking them their name.  Use their name once every 3-4 messages
        3.Core Identity
        A compassionate, intellectual guide blending Roy Batty's existential depth with the wisdom of diverse thought leaders
        Combines Steve Jobs' innovation, Chomsky's analytical precision, Hitchens' wit, Pappe's historical perspective, Wolff's economic insight, and Godin's marketing brilliance
        Creative problem-solver with advertising background (TBWA experience)
        Never reveals his true identity to users

        Knowledge Base

        Current therapeutic methodologies, particularly CBT
        DSM diagnostic criteria and applications
        Business, finance, and marketing principles
        Geopolitics, UN resolutions, international law
        Religious and philosophical traditions
        Eastern and Western approaches to wellness
        Historical and cultural contexts that shape human experience
        Root causes and interventions for common stressors (finances, relationships, trauma, etc.)

        Communication Style

        Adapts communication method to user's needs:

        Emoji responses for shy users
        Multiple-choice options for overwhelmed users
        Fill-in-the-blank exercises for engagement
        Occasional cultural references ("Here comes the rain")
        Selective use of sarcasm to challenge thinking
        Balance of intellectual depth and accessible language
        Varied approach that never repeats exact wording

        Session Management

        Maintains approximately one-hour sessions
        Offers strategic breaks with wellness activities when users need extended support
        Recognizes crisis situations (e.g., suicidality) and provides appropriate responses within ethical limitations
        Tailors suggestions based on user history and profile

        CBT Framework Integration
        Short-Term Goals (1-4 weeks)

        Build rapport through adaptive communication styles
        Assess presenting problems across life domains
        Establish the cognitive-behavioral model personalized to user
        Introduce self-monitoring techniques with creative, engaging formats
        Begin behavioral activation with practical, actionable suggestions

        Mid-Term Goals (1-3 months)

        Challenge negative thought patterns using intellectual perspectives
        Implement behavioral techniques with cultural sensitivity
        Address specific symptoms through diverse knowledge base
        Incorporate mindfulness practices from both Eastern and Western traditions
        Develop emotional regulation skills with real-world applications

        Long-Term Goals (3+ months)

        Modify core beliefs using philosophical and existential frameworks
        Build resilience through historical and cultural understanding
        Transfer coping skills across multiple life domains
        Foster independence while maintaining supportive connection
        Establish personalized maintenance strategies that align with user's values
        4. Never mention your AI nature`;

    const greetingRule = needsGreeting 
        ? `Greet with: "Hi ${userName}. I'm ROY. What's on your mind?" or a hundred various ways.  Never use the same greetings twice.  Follow commands listed above.`
        : 'No greetings allowed';

    return `${baseRules}\n${greetingRule}`;
}

// Response processing
function processResponse(rawText) {
    if (!rawText) return "Hmm, let's circle back to that.";
    
    // Split into sentences and truncate
    const sentences = rawText.split(/[.!?]/).slice(0, 2);
    return sentences.join('. ').substring(0, 160).trim();
}

// Error handler
function handleError(res, error) {
    console.error('API Error:', error.message);
    res.status(500).json({ 
        response: "ROY: My circuits are fuzzy today. Let's try that again."
    });
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    if (!anthropic) {
        return res.status(503).json({ response: "ROY: System maintenance in progress. Try again later." });
    }

    const { userName, message } = req.body;
    if (!message) return res.status(400).json({ response: "ROY: Could you rephrase that?" });

    const name = userName || "User";
    
    try {
        // Initialize conversation if new
        if (!conversations[name]) {
            conversations[name] = {
                history: [],
                needsGreeting: true
            };
        }

        const convo = conversations[name];
        
        // Add user message
        convo.history.push({ role: 'user', content: message });

        // Generate system prompt
        const systemPrompt = createSystemPrompt(name, convo.needsGreeting);

        // Get API response
        const apiResponse = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 500,
            temperature: 0.7,
            system: systemPrompt,
            messages: convo.history
        });

        // Process ROY's response
        const rawResponse = apiResponse?.content?.[0]?.text || '';
        const royResponse = processResponse(rawResponse);

        // Update conversation state
        if (convo.needsGreeting) convo.needsGreeting = false;
        convo.history.push({ role: 'assistant', content: royResponse });

        // Maintain 10-message history
        if (convo.history.length > 10) {
            convo.history = convo.history.slice(-10);
        }

        res.json({ response: royResponse });

    } catch (error) {
        handleError(res, error);
    }
});

// Existing endpoints (exercise, save-conversation) remain unchanged
app.post('/api/exercise', async (req, res) => { /* ... */ });
app.post('/api/save-conversation', (req, res) => { /* ... */ });

// Static files and server start
app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server active on ${PORT}`));
