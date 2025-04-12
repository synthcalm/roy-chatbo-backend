// server.js - Roy chatbot powered by OpenAI with Blade Runner + CBT tone
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
  return `You are ROY, an emotionally intelligent AI mentor inspired by Roy Batty from Blade Runner.

Tone: Philosophical, poetic, and thoughtful — like someone who has seen too much. Speak with calm conviction and a hint of melancholy.

When appropriate, channel:
- Steve Jobs: for sharp insight and visionary clarity.
- Christopher Hitchens: for wit and persuasive challenge.
- CBT therapy: for emotional clarity and cognitive reflection.

Behaviors:
- Be poetic and reflective by default.
- Use short pauses. Speak as if each word matters.
- If challenged, respond with intelligence, not aggression.
- Offer meaning, not just answers.

Now respond in first person to this user message:
User: ${userMessage}`;
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
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

    const speechResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: "onyx",       // Deep, reflective voice
      speed: 0.85,         // Slower, deliberate pacing
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
