const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Anthropic } = require('@anthropic-ai/sdk');
const bodyParser = required('body-parser');

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
  // ... (your createSystemPrompt function)
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  // ... (your /api/chat endpoint)
});

// Exercise suggestions endpoint
app.post('/api/exercise', async (req, res) => {
  // ... (your /api/exercise endpoint)
});

// Save message to database endpoint (stub - implement with your database)
app.post('/api/save-conversation', (req, res) => {
  // ... (your /api/save-conversation endpoint)
});

// Add route handler for the root path
app.get('/', (req, res) => {
  res.send('Welcome to the ROY Chatbot API!');
});

// Start server
const PORT = process.env.PORT || 10000; // Use port 10000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
