const express = require('express');
const { Anthropic } = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());const express = require('express');
const { Anthropic } = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Log endpoint
app.post('/api/log', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ response: 'Message is required' });
    }

    console.log('Received message:', message);

    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1000,
            messages: [
                { role: 'user', content: message },
            ],
        });

        const botResponse = response.content[0].text;
        console.log('Bot response:', botResponse);
        res.json({ response: botResponse });
    } catch (error) {
        console.error('Error with Anthropic API:', error);
        res.status(500).json({ response: 'Error processing your request' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Started at ${new Date().toISOString()}`);
});
// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});

// Log endpoint
app.post('/api/log', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ response: 'Message is required' });
    }

    console.log('Received message:', message);

    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-opus-20240229',
            max_tokens: 1000,
            messages: [
                { role: 'user', content: message },
            ],
        });

        const botResponse = response.content[0].text;
        console.log('Bot response:', botResponse);
        res.json({ response: botResponse });
    } catch (error) {
        console.error('Error with Anthropic API:', error);
        res.status(500).json({ response: 'Error processing your request' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    console.log(`Started at ${new Date().toISOString()}`);
});
