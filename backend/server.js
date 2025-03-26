const express = require('express');
const { Anthropic } = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY, // Get API key from environment
});

app.post('/api/log', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const response = await anthropic.messages.create({
            model: 'claude-3-sonnet-20240229', // Corrected model selection!
            max_tokens: 1000,
            messages: [{ role: 'user', content: message }],
        });

        const botResponse = response.content[0].text;
        res.json({ response: botResponse });
    } catch (error) {
        console.error('Anthropic API Error:', error);
        res.status(500).json({ error: 'Failed to get response from bot' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
