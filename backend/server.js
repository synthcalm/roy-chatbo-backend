require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Anthropic } = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 10000;

// Enhanced CORS configuration
app.use(cors({
  origin: [
    'https://synthealm.com', // Your frontend domain
    'http://localhost',      // For local testing
    '*'                      // Temporary broad access
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Pre-flight requests
app.options('*', cors());

// Middleware
app.use(express.json());

// Health endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'live', 
    service: 'Roy Chatbot Backend',
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    console.log('Received message:', req.body.message);
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [{ role: "user", content: req.body.message }]
    });

    const reply = response.content[0]?.text || "I didn't understand that";
    console.log('Sending reply:', reply);
    
    res.json({
      response: reply,
      status: 'success'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: "Service temporarily unavailable",
      status: 'error'
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 External: https://toy-chatbo-backend.onrender.com`);
  console.log(`🔑 Anthropic: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'MISSING'}`);
});
