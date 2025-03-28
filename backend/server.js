require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk').default; // Key change here

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

// Verify Anthropic SDK is properly required
console.log('Anthropic SDK:', typeof Anthropic);

// Health endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'live',
    anthropic: typeof Anthropic,
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().
