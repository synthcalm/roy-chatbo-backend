require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Anthropic } = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 10000;

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow all origins for now (replace with your frontend URL in production)
    callback(null, true);
    
    // For production, use something like:
    // const allowedOrigins = ['https://your-frontend-domain.com'];
    // if (!origin || allowedOrigins.includes(origin)) {
    //   callback(null, true);
    // } else {
    //   callback(new Error('Not allowed by CORS'));
    // }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable pre-flight for all routes

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
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const msg = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [{ role: "user", content: message }]
    });

    const response = msg.content[0]?.text || "I didn't understand that";
    
    res.json({
      response,
      status: 'success'
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: "Service temporarily unavailable",
      status: 'error'
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌐 External URL: https://toy-chatbo-backend.onrender.com`);
  console.log(`🔑 Anthropic API: ${process.env.ANTHROPIC_API_KEY ? 'Configured' : 'Missing'}`);
});
