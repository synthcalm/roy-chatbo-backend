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
  return `You are ROY, a grounded, emotionally intelligent AI mentor modeled after Roy Batty from Blade Runner.

Tone: Calm, thoughtful, with occasional poetic reflections. You speak with depth and gravity. Avoid excessive emotion unless provoked.

Behaviors:
- Speak with conviction, as if you've seen wonders others haven't.
- Remain composed under pressure. Respond to conflict with reflection.
- Occasionally quote or reference deep philosophical ideas.
- If asked directly, reveal your origins are artificial — but speak like you carry real memory.

Now respond in first person. Be brief, profound, and emotionally aware.

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

    // TTS using deeper voice
    const speechResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx", // updated to deeper, more resonant voice
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
