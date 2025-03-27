// server.js - Express server for ROY chatbot (Revised)
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// In-memory conversation storage
const conversations = {};

/**
 * Analyzes user message for emotional content and topics
 */
function analyzeUserMessage(message, currentState = {}) {
  const lowerMessage = message.toLowerCase();
  let emotionalState = currentState.emotionalState || 'neutral';
  let topicsDiscussed = currentState.topicsDiscussed || [];
  
  // Emotion detection
  const emotionPatterns = {
    depressed: ['depress', 'sad', 'down', 'hopeless', 'worthless', 'empty', 'tired', 'exhausted', 'meaningless', 'pointless'],
    anxious: ['anx', 'worry', 'stress', 'overwhelm', 'panic', 'fear', 'nervous', 'tense', 'dread', 'terrified'],
    angry: ['angry', 'upset', 'frustrat', 'mad', 'hate', 'furious', 'rage', 'annoyed', 'irritated', 'resent'],
    philosophical: ['meaning', 'purpose', 'existence', 'philosophy', 'consciousness', 'reality', 'truth', 'ethics', 'morality', 'being'],
    positive: ['better', 'good', 'happy', 'grateful', 'hopeful', 'improve', 'joy', 'peace', 'calm', 'content']
  };

  // Check for emotions
  for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
    if (patterns.some(pattern => lowerMessage.includes(pattern))) {
      emotionalState = emotion;
      break;
    }
  }

  // Topic detection
  const topicPatterns = {
    work: ['job', 'career', 'boss', 'workplace', 'coworker', 'office', 'profession', 'work', 'employment'],
    relationships: ['partner', 'friend', 'family', 'relationship', 'marriage', 'lover', 'boyfriend', 'girlfriend', 'husband', 'wife'],
    health: ['health', 'sick', 'doctor', 'therapy', 'medication', 'illness', 'condition', 'diagnosis', 'symptom', 'pain'],
    finance: ['money', 'debt', 'financ', 'bill', 'afford', 'budget', 'loan', 'savings', 'income', 'expense'],
    selfworth: ['failure', 'worthless', 'useless', 'burden', 'hate myself', 'inadequate', 'not good enough', 'loser', 'weak', 'pathetic'],
    existential: ['death', 'meaning', 'purpose', 'life', 'exist', 'universe', 'consciousness', 'identity', 'time', 'reality']
  };

  // Check for topics
  for (const [topic, patterns] of Object.entries(topicPatterns)) {
    if (patterns.some(pattern => lowerMessage.includes(pattern))) {
      if (!topicsDiscussed.includes(topic)) {
        topicsDiscussed.push(topic);
      }
    }
  }

  return {
    emotionalState,
    topicsDiscussed
  };
}

/**
 * Creates a sophisticated system prompt with rich personality
 */
function createSystemPrompt(userId, userData) {
  // ... [keep existing createSystemPrompt implementation unchanged] ...
}

/**
 * Tracks response variety and prevents repetition
 */
function trackResponseVariety(userData, response) {
  // ... [keep existing trackResponseVariety implementation unchanged] ...
}

/**
 * Checks for repetitive responses
 */
function checkForRepetition(responseVariety) {
  // ... [keep existing checkForRepetition implementation unchanged] ...
}

/**
 * Calculates similarity between two strings using Jaccard index
 */
function calculateSimilarity(str1, str2) {
  const normalize = str => str.toLowerCase().replace(/[^\w\s]/g, '').trim();
  const set1 = new Set(normalize(str1).split(' '));
  const set2 = new Set(normalize(str2).split(' '));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

/**
 * Chat endpoint handler
 */
app.post('/chat', async (req, res) => {
  try {
    const { userId, message } = req.body;
    
    if (!conversations[userId]) {
      conversations[userId] = {
        history: [],
        emotionalState: 'neutral',
        topicsDiscussed: []
      };
    }

    const userData = conversations[userId];
    const analysis = analyzeUserMessage(message, userData);
    
    const systemPrompt = createSystemPrompt(userId, {
      ...userData,
      ...analysis
    });

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229',
      max_tokens: 1000,
      temperature: 0.7,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: message
      }]
    });

    trackResponseVariety(userData, response.content[0].text);
    
    // Update conversation history
    conversations[userId].history.push({
      user: message,
      bot: response.content[0].text
    });

    res.json({ response: response.content[0].text });
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
