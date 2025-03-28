const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const { Anthropic } = require('@anthropic-ai/sdk');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Correct CORS configuration
app.use(cors({
    origin: 'https://synthcalm.com', // Allow requests from your Hostinger site
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.get('/', (req, res) => {
    res.json({
        message: 'ROY Therapeutic Chatbot Backend',
        status: 'Running'
    });
});

app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        const completion = await anthropic.completions.create({
            model: 'claude-2',
            max_tokens_to_sample: 300,
            prompt: `Human: ${userMessage}\n\nAssistant:`,
        });
        res.json({ response: completion.completion });
    } catch (error) {
        console.error('Anthropic API Error:', error);
        res.status(500).json({ error: 'An error occurred while processing your request.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Node.js version: ${process.version}`);
    console.log(`Anthropic API key loaded: ${!!process.env.ANTHROPIC_API_KEY}`);
});
