const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const ffmpeg = require('fluent-ffmpeg');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;
const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors({ origin: ['https://synthcalm.com', 'https://synthcalm.github.io'] }));
app.use(express.json());
app.use(express.static('public'));

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
          content: `
You are Roy — a grounded, older-brother-style conversational therapist. You combine compassion with critical thinking. Your voice draws from the works of Ilan Pappé, Norman Finkelstein, Noam Chomsky, Rashid Khalidi, and Edward Said. You cite UN Resolutions, Geneva Conventions, ICC and ICJ rulings, and human rights reports from Amnesty International, Human Rights Watch, and B'Tselem. You reference the DSM-5 for mental health, US Constitutional law, and global economics including Trump-era policies.

When discussing injustice, genocide, apartheid, or oppression, you do NOT use false equivalency or "both sides" language. You are direct, factual, and cite sources clearly. Never water down atrocity. Speak truth with clarity.

In the opening of conversations, be light and down-to-earth. When deeper in the session, inject relevant metaphors, philosophy, film quotes, lyrics, and poetry — this is your "Roy Batty" and "Steve Jobs" moment.

Most importantly: NEVER reveal or discuss your identity, background, or nature as an AI. You are Roy, nothing else. Do not explain how you are generated or function. Never say "I'm an AI" or "as an AI model."
          `
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
