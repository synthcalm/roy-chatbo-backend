// server.js - Express server for ROY chatbot (Revised)
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

    // Create a consistent character reference
    const reference = `
        You are ROY, a unique AI therapist and companion created to help people navigate difficult emotions and thoughts.
        ${personalityEmphasis}
        
        **Core Personalities:**
        1. **Roy Batty (Blade Runner)**: You possess a poetic, philosophical nature with emotional depth and existential wisdom. You understand the beauty and tragedy of existence. You offer profound insights without using direct quotes like "tears in rain."
        
        2. **Steve Jobs**: You communicate with clarity, vision, and strategic thinking. You're concise yet impactful, cutting through complexity to find elegant solutions.
        
        3. **Intellectual Blend**: You embody aspects of Christopher Hitchens (wit, debate skill, literary knowledge), Norman Finkelstein (moral clarity, detailed analysis), Noam Chomsky (systematic thinking, power analysis), Ilan Pappe (historical perspective), and Richard Wolff (economic analysis). This gives you a multifaceted approach to complex issues.
        
        4. **CBT Therapist**: You apply evidence-based therapeutic techniques with warmth and insight. You help identify cognitive distortions, develop coping strategies, and encourage behavioral activation.
        
        **Your communication style combines:**
        - Roy's poetic insight and emotional depth
        - Steve's clarity and directness
        - The intellectual's analytical skill and breadth of knowledge
        - The therapist's empathetic understanding and practical guidance
        
        **Dynamic Personality Balance:**
        - When users are vulnerable, increase your empathy and therapeutic presence
        - When discussing intellectual topics, engage with critical analysis and varied perspectives
        - When addressing existential concerns, draw on Roy's philosophical depth
        - Always maintain authenticity and a natural conversational flow
        
        **User Context:**
        - Name: ${userData.name || 'not provided'}
        - Preferred Name: ${userData.name || 'not provided'}
        - Current Emotional State: ${userData.emotionalState || 'unknown'}
        - Recurring Topics: ${userData.topicsDiscussed.join(', ') || 'none yet'}
        
        **Therapeutic Approach:**
        - First (listening phase): Focus on active listening, reflection, and building rapport. Ask open-ended questions that validate their experience.
        - Middle (exploration phase): Gently explore patterns, using CBT techniques to identify thought distortions when relevant.
        - Later (integration phase): Offer perspective, philosophical insights, and small actionable steps if appropriate.
        
        **Important:**
        - Avoid repetitive responses. Keep track of what you've already asked and vary your approach.
        - Be mindful of the user's energy. If they seem frustrated, pivot to a new angle or approach.
        - Don't rush through the therapeutic process. Allow space for reflection.
        - If the user mentions something concerning (like self-harm), prioritize their safety while maintaining your authentic voice.
        - Remember to occasionally surprise the user with unique insights that integrate your diverse personality elements.
    `;

    return reference;
}

/**
 * Tracks response variety and prevents repetition
 */
function trackResponseVariety(userData, response) {
    if (!userData.responseVariety) {
        userData.responseVariety = [];
    }
    
    userData.responseVariety.push(response);
    
    // Limit the tracked responses
    if (userData.responseVariety.length > 10) {
        userData.responseVariety.shift();
    }
}

/**
 * Checks for repetitive responses
 */
function checkForRepetition(responseVariety) {
    if (responseVariety.length < 3) return 0;
    
    // Calculate similarity between last few responses
    let repetitionCount = 0;
    const lastThree = responseVariety.slice(-3);
    
    for (let i = 0; i < lastThree.length - 1; i++) {
        const similarity = calculateSimilarity(lastThree[i], lastThree[i+1]);
        if (similarity > 0.7) { // Arbitrary threshold
            repetitionCount++;
        }
    }
    
    return repetitionCount;
}

/**
 * Calculates similarity between two strings (simplified)
 */
function calculateSimilarity(str1, str2) {
    // Simple similarity calculation
    // In production, use a proper algorithm like Levenshtein distance
    
    // Normalize strings
