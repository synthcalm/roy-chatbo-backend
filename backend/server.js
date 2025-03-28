require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Anthropic } = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 10000;

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://youtube.lm.com', // Your frontend domain
    'http://localhost',       // For local testing
    '*'                       // Temporary for debugging
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Middleware
app.use(express.json());

// Health check endpoint with key verification
app.get('/', (req, res) => {
  res.json({
    status: 'live',
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [{ role: "user", content: req.body.message }]
    });

    res.json({
      response: response.content[0]?.text || "I didn't understand that",
      status: 'success'
    });

  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({
      error: "Service unavailable",
      details: error.message,
      status: 'error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Anthropic API key: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'MISSING'}`);
});
