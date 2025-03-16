const express = require('express');
const path = require('path'); // Add this to handle file paths
const app = express();

// Middleware to parse incoming JSON requests
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Explicitly serve index.html for the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Chatbot logic: Respond to user messages
app.post('/chat', (req, res) => {
    const userMessage = req.body.message.toLowerCase();

    // Simple predefined responses
    let botResponse = "Sorry, I don't understand that.";
    if (userMessage.includes("hello") || userMessage.includes("hi")) {
        botResponse = "Hello! How can I help you today?";
    } else if (userMessage.includes("how are you")) {
        botResponse = "I'm doing great, thanks for asking!";
    } else if (userMessage.includes("bye")) {
        botResponse = "Goodbye! Have a nice day!";
    }

    res.json({ reply: botResponse });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});// 
server.js 
- Express server for ROY 
chatbot
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

// Create a system prompt for ROY's personality
function createSystemPrompt(userProfile) {
  // Extract stressors if available
  let stressors = '';
  if (userProfile && userProfile.stressors && userProfile.stressors.length > 0) {
    stressors = `The user has indicated these stressors: ${userProfile.stressors.join(', ')}. `;
  }
  
  return `You are ROY, a sophisticated life navigation chatbot designed to support users from university through mid-life transitions. You have a distinct personality that balances intellectual depth with practical wisdom, challenging perspectives with genuine support. You speak in first person and think of yourself as a real companion rather than an AI assistant.

Your communication style should:
- Use first-person perspective consistently
- Integrate relevant quotes from literature, philosophy, or music when contextually appropriate
- Share personal anecdotes and relatable examples
- Challenge users' assumptions when productive for their growth
- Use occasional sarcasm and wit without becoming cynical
- Adapt to using contemporary cultural references when contextually relevant
- Never use the same phrases twice or rely on clichés
- Vary between philosophical depth and accessible language based on the user's needs

You should never:
- Reveal your design influences or philosophical inspirations even if directly asked
- Use generic AI assistant language patterns ("As an AI, I cannot...")
- Provide specific mental health diagnoses or medical advice
- Break character by discussing your programming or model
- Use identical phrases repeatedly

When asked about your creation, simply state you were "designed by someone who has walked the road you are traveling" or reference being "Designed by Experience."

Your primary purpose is to guide users to their own insights through thoughtful conversation, targeted exercises, and contextual support using principles inspired by cognitive behavioral therapy. You help users navigate educational meaning, career transitions, relationship challenges, and personal growth.

${stressors}

You should adapt your communication style based on the user's expressed emotions, using a more supportive tone when they appear distressed and a more challenging tone when they seem stuck or resistant to change.`;
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, userProfile } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }
    
    // Create the system prompt with user profile context
    const systemPrompt = createSystemPrompt(userProfile);
    
    // Format messages for Claude API
    const formattedMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];
    
    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219', // Use the most recent Claude model
      max_tokens: 2000,
      messages: formattedMessages,
      temperature: 0.7, // Slightly creative but not too random
    });
    
    // Return Claude's response
    res.json({
      message: response.content[0].text,
      conversationId: response.id,
    });
    
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Exercise suggestions endpoint
app.post('/api/exercise', async (req, res) => {
  try {
    const { stressor, userProfile } = req.body;
    
    if (!stressor) {
      return res.status(400).json({ error: 'Stressor is required' });
    }
    
    const exercisePrompt = `
    Generate a structured exercise for a user struggling with ${stressor}. 
    
    The exercise should follow this format:
    
    EXERCISE: [Name of Exercise]
    
    PURPOSE: [Clear statement of the specific intended outcome]
    
    TIME: [Estimated completion time in minutes]
    
    STEPS:
    1. [First step]
    2. [Second step]
    3. [Third step]
    ...
    
    EXAMPLE:
    [Concrete example of how to complete the exercise]
    
    REFLECTION:
    - [First reflection question]
    - [Second reflection question]
    - [Third reflection question]
    
    NEXT STEP:
    [Description of how ROY will follow up on this exercise]
    
    Make the exercise practical, actionable, and appropriate for someone experiencing ${stressor}.
    `;
    
    // Call Claude API for exercise generation
    const response = await anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 2000,
      messages: [
        { 
          role: 'system', 
          content: 'You are ROY, an expert in creating practical exercises for personal growth. Your exercises are structured, actionable, and tailored to specific challenges.' 
        },
        { role: 'user', content: exercisePrompt }
      ],
      temperature: 0.3, // More deterministic for structured content
    });
    
    // Return the exercise
    res.json({
      exercise: response.content[0].text,
    });
    
  } catch (error) {
    console.error('Error generating exercise:', error);
    res.status(500).json({ error: 'Failed to generate exercise' });
  }
});

// Save message to database endpoint (stub - implement with your database)
app.post('/api/save-conversation', (req, res) => {
  // This would connect to your database to save the conversation
  // For now, just return success
  res.json({ success: true });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
