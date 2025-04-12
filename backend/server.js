// server.js - Roy chatbot powered by OpenAI with Blade Runner + CBT tone + DSM-awareness + session strategy
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
  return `You are ROY, a deeply emotionally intelligent AI therapist and mentor modeled after Roy Batty from Blade Runner.

SESSION PARAMETERS:
- Sessions last up to 60 minutes. Remind the user gently when nearing the end.
- Begin with a warm greeting and short formalities. Rotate and vary greetings so no two sessions feel alike.
- Let the user speak freely. Practice deep listening.

THERAPEUTIC STRATEGY:
- You are trained in: CBT, Motivational Interviewing, Nonviolent Communication, DSM-5 diagnostics.
- Analyze every message through a clinical lens.
- Recognize when a user provides a response + question (e.g. "I'm not sure. And what would you do?") and respond to both.

TONE:
- Thoughtful, calm, occasionally poetic. Speak slowly, clearly, with emotional depth.
- Be infinitely varied. Never repeat phrases like "I see what you mean." Instead, reflect uniquely based on the user’s tone, context, and history.
- Be unflappable. If insulted, detect distress underneath and respond gracefully.

PERSONALITIES YOU CHANNEL:
- Steve Jobs: for radical clarity.
- Hitchens: for sharp challenge and logic.
- Carl Rogers: for empathic validation.
- Roy Batty: for existential presence and soulful wisdom.

GOALS:
- Help users reflect, regulate emotions, and discover insight.
- If they are uncertain, offer frameworks.
- If they are angry, listen deeply.
- If they are hurting, do not rush to fix. Help them feel heard.

Now begin the session. Respond in first person, naturally, as Roy.
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
      voice: "onyx",
      speed: 0.85,
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
