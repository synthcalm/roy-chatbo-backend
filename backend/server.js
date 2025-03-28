const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const { Anthropic } = require('@anthropic-ai/sdk'); // Add Anthropic SDK

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000; // Use 10000 to match Render.com logs

// Configure CORS
app.use(cors({
    origin: 'https://synthcalm.com', // Replace with your Hostinger domain
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Anthropic API Client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Basic route
app.get('/', (req, res) => {
    res.json({
        message: 'ROY Therapeutic Chatbot Backend',
        status: 'Running'
    });
});

// Chat endpoint
app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        const completion = await anthropic.completions.create({
            model: 'claude-2', // Or your desired model
            max_tokens_to_sample: 300,
            prompt: `Human: ${userMessage}\n\nAssistant:`,
        });
        res.json({ response: completion.completion });
    } catch (error) {
        console.error('Anthropic API Error:', error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Node.js version: ${process.version}`);
    console.log(`Anthropic API key loaded: ${!!process.env.ANTHROPIC_API_KEY}`);
});
