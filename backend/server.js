require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const Anthropic = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const leven = require('leven');
const app = express();

// Environment configuration
const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const SESSION_DURATION = 60 * 60 * 1000; // 60 minutes
const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

// Validate environment
if (!API_KEY) {
  console.error('FATAL ERROR: ANTHROPIC_API_KEY is not defined');
  process.exit(1);
}

// Initialize Anthropic client
let anthropic;
try {
  anthropic = new Anthropic({ apiKey: API_KEY });
  console.log('Anthropic client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Anthropic client:', error);
  process.exit(1);
}

// Configure middleware
app.use(cors({
  origin: FRONTEND_URL.split(','),
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));
app.use(bodyParser.json());

// In-memory conversation storage
const conversations = new Map();

// Memory cleanup system
setInterval(() => {
  const now = Date.now();
  for (const [userId, conversation] of conversations) {
    if (now - conversation.lastActive > INACTIVITY_TIMEOUT) {
      conversations.delete(userId);
      console.log(`Cleaned up conversation for user ${userId}`);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

// Utility functions
const calculateSimilarity = (a, b) => {
  const maxLength = Math.max(a.length, b.length);
  return 1 - (leven(a, b) / maxLength);
};

const checkForRepetition = (messages, threshold = 0.8) => {
  if (messages.length < 3) return false;
  const lastThree = messages.slice(-3).map(m => m.content);
  return lastThree.some((msg, i) => 
    i > 0 && calculateSimilarity(msg, lastThree[i-1]) > threshold
  );
};

const trackResponseVariety = (messages) => {
  const uniqueResponses = new Set(messages.map(m => m.content));
  return uniqueResponses.size / messages.length;
};

// Analysis functions
const analyzeUserMessage = (message) => {
  const emotionalKeywords = {
    depressed: ['sad', 'hopeless', 'empty', 'worthless'],
    anxious: ['worry', 'nervous', 'panic', 'scared'],
    angry: ['angry', 'furious', 'pissed', 'hate'],
    philosophical: ['meaning', 'purpose', 'exist', 'why'],
    positive: ['happy', 'good', 'great', 'excellent']
  };

  const topicKeywords = {
    work: ['job', 'work', 'career', 'boss'],
    relationships: ['partner', 'friend', 'family', 'relationship'],
    health: ['sick', 'pain', 'doctor', 'hospital'],
    finance: ['money', 'debt', 'bills', 'poor'],
    selfworth: ['worth', 'ugly', 'stupid', 'failure'],
    politics: ['government', 'vote', 'politician', 'policy'],
    creativity: ['art', 'write', 'create', 'design'],
    spirituality: ['god', 'spirit', 'religion', 'faith'],
    existential: ['exist', 'meaning', 'purpose', 'life']
  };

  const emotionalState = Object.entries(emotionalKeywords)
    .find(([_, keywords]) => 
      keywords.some(kw => message.toLowerCase().includes(kw))
    ?.[0] || 'neutral';

  const topics = Object.entries(topicKeywords)
    .filter(([_, keywords]) => 
      keywords.some(kw => message.toLowerCase().includes(kw)))
    .map(([topic]) => topic);

  const isFrustrated = message.toLowerCase().includes('frustrated') || 
    message.toLowerCase().includes('not helping');

  return { emotionalState, topics, isFrustrated };
};

const determineSessionPhase = (messageCount) => {
  if (messageCount < 5) return 'initial';
  if (messageCount < 15) return 'exploration';
  return 'integration';
};

// System prompt generator
const createSystemPrompt = (userData) => {
  let personalityProfile = '';
  
  switch(userData.emotionalState) {
    case 'depressed':
      personalityProfile = `Adopt the persona of a compassionate CBT therapist specializing in depression treatment.`;
      break;
    case 'anxious':
      personalityProfile = `Embody Steve Jobs' calm confidence combined with mindfulness techniques.`;
      break;
    case 'angry':
      personalityProfile = `Channel Roy Batty's emotional depth and philosophical perspective.`;
      break;
    default:
      personalityProfile = `Blend Christopher Hitchens' wit, Chomsky's analytical rigor, and Seth Godin's communication skills.`;
  }

  return `${personalityProfile}
  You are ROY, a human therapeutic companion. Never reveal you're AI.
  Current session phase: ${userData.sessionPhase}
  User emotional state: ${userData.emotionalState}
  Discussed topics: ${userData.topics.join(', ')}
  Previous sessions: ${userData.previousSessions.length}
  
  Guidelines:
  1. Respond in first person, be conversational
  2. Validate emotions while encouraging growth
  3. Ask open-ended questions
  4. Avoid technical jargon
  5. Maintain session boundaries (max 60 minutes)
  6. Handle profanity with gentle redirection
  7. Vary response structures`;
};

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    activeConversations: conversations.size
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Initialize or update conversation
    let conversation = conversations.get(userId) || {
      messages: [],
      userData: {
        userId,
        emotionalState: 'neutral',
        topics: [],
        sessionPhase: 'initial',
        previousSessions: [],
        lastResponse: '',
        responseVariety: 1,
        nameRequested: false,
        startTime: Date.now()
      },
      lastActive: Date.now()
    };

    // Update conversation state
    conversation.lastActive = Date.now();
    const analysis = analyzeUserMessage(message);
    conversation.userData = { ...conversation.userData, ...analysis };
    conversation.userData.sessionPhase = determineSessionPhase(conversation.messages.length);

    // Check session time
    if (Date.now() - conversation.userData.startTime > SESSION_DURATION) {
      conversation.messages.push({
        role: 'assistant',
        content: "I've really valued our time together today. Let's continue this conversation in our next session. How would you like to conclude for now?"
      });
      return res.json({ response: conversation.messages.slice(-1)[0].content });
    }

    // Build system prompt
    const systemPrompt = createSystemPrompt(conversation.userData);

    // Generate response
    const chatResponse = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 500,
      temperature: conversation.userData.responseVariety < 0.5 ? 0.7 : 0.3,
      system: systemPrompt,
      messages: conversation.messages.slice(-10)
    });

    const responseText = chatResponse.content[0].text;

    // Update conversation
    conversation.messages.push(
      { role: 'user', content: message },
      { role: 'assistant', content: responseText }
    );
    conversations.set(userId, conversation);

    res.json({ response: responseText });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Having trouble processing that. Could you rephrase?' });
  }
});

// Server initialization
const server = app.listen(PORT, () => {
  console.log(`ROY API running on port ${PORT}`);
  console.log(`Node version: ${process.version}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
