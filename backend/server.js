require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Anthropic } = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 10000;

// CORS Configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Middleware
app.use(express.json());

// Health Check
app.get('/', (req, res) => {
  res.json({
    status: 'live',
    message: 'Roy Chatbot Backend',
    timestamp: new Date().toISOString()
  });
});

// Chat Endpoint
app.post('/chat', async (req, res) => {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [{ role: "user", content: message }]
    });

    res.json({
      response: response.content[0]?.text || "I didn't understand that",
      status: 'success'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: "Service unavailable",
      details: error.message,
      status: 'error'
    });
  }
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Access URL: http://localhost:${PORT}`);
  console.log(`🔑 Anthropic API: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'MISSING'}`);
});
