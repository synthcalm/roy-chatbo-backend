require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Anthropic } = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 10000;

// Enable CORS
app.use(cors({
  origin: ['https://synthealm.com', 'http://localhost'],
  methods: ['GET', 'POST']
}));

app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'live',
    service: 'Roy Chatbot Backend',
    version: '1.0',
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: "Valid message is required" });
    }

    // Initialize Anthropic
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Get AI response
    const msg = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      messages: [{ role: "user", content: message }]
    });

    res.status(200).json({
      response: msg.content[0]?.text || "Roy: I didn't understand that",
      status: 'success'
    });
    
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: "Roy is having technical difficulties",
      status: 'error'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Test endpoint: http://localhost:${PORT}`);
});
