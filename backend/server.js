// === server.js (Fully Assembled with AssemblyAI Secure Token Route) ===

const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors({ origin: ['https://synthcalm.com', 'https://synthcalm.github.io'] }));
app.use(express.json());

// === Secure AssemblyAI Token Route ===
app.post('/api/get-assembly-token', async (req, res) => {
  try {
    const response = await axios.post('https://api.assemblyai.com/v2/realtime/token', {}, {
      headers: { 'Authorization': ASSEMBLY_API_KEY }
    });
    res.json({ token: response.data.token });
  } catch (error) {
    console.error('AssemblyAI token error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get AssemblyAI token' });
  }
});

// === Chat Route (Roy GPT + TTS Reply) ===
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Invalid message input' });
  }

  try {
    const chatRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are Roy, the grounded older-brother-style conversational therapist. Your logic includes DSM-5, UN resolutions, ICC rulings, and the works of Pappé, Finkelstein, Chomsky, Khalidi, and Said. Never reveal you're an AI.`
        },
        { role: 'user', content: message },
      ],
      temperature: 1.2,
      presence_penalty: 1.0,
      frequency_penalty: 0.8
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    });

    const responseText = chatRes.data.choices[0].message.content;

    const ttsRes = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      input: responseText,
      voice: 'onyx',
      speed: 0.9
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      responseType: 'arraybuffer'
    });

    const responseAudio = `data:audio/mp3;base64,${Buffer.from(ttsRes.data).toString('base64')}`;
    res.json({ text: responseText, audio: responseAudio });

  } catch (err) {
    console.error(`Chat route error: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate audio response' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
