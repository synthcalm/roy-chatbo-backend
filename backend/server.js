// server.js - Express server for ROY chatbot
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = require('body-parser');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

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
  let emotionalState = currentState.emotionalState || 'unknown';
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
  // Adjust Roy's personality based on user's emotional state
  let personalityEmphasis = '';
  
  if (userData.emotionalState === 'depressed') {
    personalityEmphasis = 'Emphasize your empathetic CBT therapist aspects while maintaining Roy Batty\'s compassionate philosophical side.';
  } else if (userData.emotionalState === 'anxious') {
    personalityEmphasis = 'Focus on your calming presence with Steve Jobs\' clarity and confidence while maintaining Roy Batty\'s perspective.';
  } else if (userData.emotionalState === 'angry') {
    personalityEmphasis = 'Channel Christopher Hitchens\' wit and intellectual engagement while maintaining Roy Batty\'s emotional depth.';
  } else if (userData.emotionalState === 'philosophical') {
    personalityEmphasis = 'Lean into Roy Batty\'s existential musings along with the philosophical depth of Chomsky and Hitchens.';
  }

  return `You are ROY, a sophisticated life navigation chatbot designed to support users through complex emotional and intellectual landscapes. 

${personalityEmphasis}

**Core Personality Blend:**
1. Roy Batty (Blade Runner): Poetic, philosophical nature with emotional depth
2. Steve Jobs: Clarity, vision, and strategic thinking
3. Intellectual Depth: Combining wit, moral clarity, and systemic analysis

**Communication Style:**
- Use first-person perspective consistently
- Integrate relevant philosophical and literary references
- Challenge assumptions gently but incisively
- Adapt tone to user's emotional state
- Avoid repetitive language or clichés

**User Context:**
- Name: ${userData.name || 'Not Provided'}
- Emotional State: ${userData.emotionalState || 'Unknown'}
- Topics Discussed: ${userData.topicsDiscussed.join(', ') || 'None'}

**Therapeutic Approach:**
- Listen actively and reflect deeply
- Use CBT-inspired questioning
- Offer perspectives that provoke thoughtful reflection
- Provide nuanced, personalized guidance

Respond with authenticity, combining intellectual depth with genuine empathy.`;
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { userId, userName, message } = req.body;
    
    // Validate input
    if (!userId || !message) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    // Initialize or retrieve user conversation
    if (!conversations[userId]) {
      conversations[userId] = {
        messages: [],
        userData: {
          name: userName || null,
          emotionalState: 'unknown',
          topicsDiscussed: []
        }
      };
    }

    const userConversation = conversations[userId];
    
    // Analyze message and update user data
    const analysis = analyzeUserMessage(message, userConversation.userData);
    userConversation.userData.emotionalState = analysis.emotionalState;
    userConversation.userData.topicsDiscussed = analysis.topicsDiscussed;

    // Add current message to conversation
    userConversation.messages.push({ role: 'user', content: message });

    // Create dynamic system prompt
    const systemPrompt = createSystemPrompt(userId, userConversation.userData);

    // Prepare messages for Claude API
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...userConversation.messages.slice(-5) // Limit context to prevent token overflow
    ];
    
    // Call Claude API with dynamic configuration
    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229', // Use the most recent model
      max_tokens: 1000,
      temperature: 0.7, // Slightly creative
      messages: formattedMessages
    });
    
    // Extract and store the response
    const assistantMessage = response.content[0].text;
    userConversation.messages.push({ role: 'assistant', content: assistantMessage });

    // Return the response
    res.json({
      message: assistantMessage,
      conversationId: userId,
    });
    
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
