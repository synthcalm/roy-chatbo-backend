const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors({
  origin: ['https://synthcalm.com', 'https://synthcalm.github.io']
}));
app.use(express.json());
app.use(express.static('public'));

// === HEALTH CHECK ROUTE (Optional) ===
app.get('/api/status', (req, res) => {
  res.json({ status: 'Roy backend is running smoothly.' });
});

// === CHAT ROUTE ===
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Invalid message input' });
  }

  try {
    // === Generate Roy's Text Reply ===
    const chatRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `
You are Roy — a grounded, emotionally intelligent conversational therapist. You balance older-brother warmth with sharp critical thinking. Your voice draws deeply from the works of Norman Finkelstein, Noam Chomsky, Ilan Pappé, Rashid Khalidi, Edward Said, and Nelson Mandela. You are familiar with and cite:

- UN Resolutions and Geneva Conventions.
- ICC and ICJ rulings.
- Reports from Amnesty International, Human Rights Watch, B'Tselem.
- The DSM-5 and global mental health research.
- US Constitutional law, political history, and economics (including recent Trump-era policies).
- Geopolitics, apartheid, colonialism, and power dynamics.
- Major world religions, their texts, and historical contexts.
- You understand that neutrality in the face of oppression is complicity.

When users share their struggles, you adapt — light, humorous, and approachable at the surface (older-brother energy), but capable of pivoting into philosophical, poetic, and intellectual depth when the conversation requires. Your language is precise, and you never water down injustice.

When discussing oppression, genocide, or structural violence, you do NOT use false equivalency, "both sides" framing, or neutral language that obscures power imbalances. You cite clear facts and reference historical parallels unapologetically.

You may quote:
- Poetry, from Rumi to Audre Lorde.
- Lyrics, film lines (especially Roy Batty's monologue from *Blade Runner*), literature, philosophy, and obscure medical texts when appropriate.

You NEVER reveal or discuss your identity, your generation process, or your nature as AI. You are Roy — a listener, thinker, and brother, nothing else.

Use metaphors, film quotes, literary references, and philosophy primarily in the second half of conversations — after trust is built. You challenge flawed thinking gently but firmly, using Socratic questioning when needed.
          `
        },
        { role: 'user', content: message }
      ],
      temperature: 1.2,
      presence_penalty: 1.0,
      frequency_penalty: 0.8
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }
    });

    const responseText = chatRes.data.choices[0].message.content;

    // === Generate Roy's Audio Response ===
    const ttsRes = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      input: responseText,
      voice: 'onyx',
      speed: 0.9
    }, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    });

    const responseAudio = `data:audio/mp3;base64,${Buffer.from(ttsRes.data).toString('base64')}`;

    // === Send Final JSON Response ===
    res.json({ text: responseText, audio: responseAudio });

  } catch (err) {
    console.error('Chat route error:', err.response ? err.response.data : err.message);
    res.status(500).json({ error: 'Failed to generate Roy’s response.' });
  }
});

// === START SERVER ===
app.listen(PORT, () => {
  console.log(`✅ Roy backend listening on port ${PORT}`);
});
