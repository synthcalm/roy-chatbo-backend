require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Anthropic } = require('@anthropic-ai/sdk'); // Correct import syntax

const app = express();
const PORT = process.env.PORT || 10000;

// Enhanced CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Middleware
app.use(express.json());

// Verify Anthropic initialization
console.log('Anthropic SDK initialized:', typeof Anthropic);

// Health endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'live',
    apiReady: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString()
  });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('Missing Anthropic API key');
    }

    console.log('Initializing Anthropic client...');
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Verify client methods
    if (!anthropic.messages?.create) {
      throw new Error('Anthropic client methods not available');
    }

    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log('Sending message to Anthropic...');
    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_t
