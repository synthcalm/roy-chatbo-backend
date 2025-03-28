require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Anthropic } = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 10000;

// Enhanced CORS configuration
app.use(cors({
  origin: '*', // For now, allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Middleware to log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'live',
    service: 'Roy Chatbot Backend',
    version: '1.0.1',
    endpoints: {
      chat: '/chat (POST)',
      health: '/health (GET)'
    },
    timestamp: new Date().toISOString()
  });
});

// Additional health endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    db: 'connected',
    anthropic: process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing'
  });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    console.log('Received chat request:', req.body);
    
    if (!req.body.message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const msg = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [{ role: "user", content: req.body.message }]
    });

    const response = msg.content[0]?.text || "Roy: I didn't understand that";
    console.log('Sending response:', response);
    
    res.status(200).json({
      response,
      status: 'success'
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: "Roy is having technical difficulties",
      status: 'error',
      details: error.message
    });
  }
});

// Handle 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    available_endpoints: {
      GET: ['/', '/health'],
      POST: ['/chat']
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Local: http://localhost:${PORT}`);
  console.log(`🌐 External: https://toy-chatbo-backend.onrender.com`);
  console.log(`🔑 Anthropic: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'MISSING KEY'}`);
});
