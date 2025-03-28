require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Anthropic } = require('@anthropic-ai/sdk'); // Or your AI service SDK

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.send('Roy Chatbot Backend is Running');
});

// Chat endpoint
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        // Replace with your actual AI service call
        const mockResponse = `Roy: I received your message: "${message}"`;
        
        // If using Anthropic:
        // const anthropic = new Anthropic(process.env.ANTHROPIC_API_KEY);
        // const response = await anthropic.messages.create({...});
        
        res.json({ 
            response: mockResponse,
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
    console.log(`Server running on port ${PORT}`);
    console.log(`Node.js version: ${process.version}`);
    console.log(`Anthropic API key loaded: ${!!process.env.ANTHROPIC_API_KEY}`);
});
