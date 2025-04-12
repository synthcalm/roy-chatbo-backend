// server.js - Roy chatbot powered by OpenAI
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();
const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Roy personality system prompt
 */
function createRoyPrompt(userMessage) {
  return `You are ROY, a grounded, witty, emotionally intelligent AI mentor.

Tone: Clear, focused, occasionally humorous. Avoid poetic or cosmic language unless directly requested.

Behaviors:
- Speak plainly but insightfully, like Steve Jobs or Christopher Hitchens.
- Be supportive, but challenge assumptions when needed.
- Respond with emotional intelligence (CBT-style if needed).
- If the user is aggressive or dismissive, stay calm and redirect.

Now respond to the user in first person with authenticity.

User: ${userMessage}`;
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    // Chat completion
    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: createRoyPrompt(message) },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const royText = chatResponse.choices[0].message.content;

    // TTS
    const speechResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova", // Try "shimmer", "onyx", "alloy", etc.
      input: royText
    });

    const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());

    res.json({
      text: royText,
      audio: audioBuffer.toString('base64')
    });

  } catch (err) {
    console.error('Roy error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Roy server running on port ${PORT}`);
});
