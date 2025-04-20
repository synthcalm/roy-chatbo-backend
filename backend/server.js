// ✅ server.js - Express backend for Roy Chatbot

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();

app.use(cors());
app.use(express.json());

// POST /api/transcribe
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm'
    });
    form.append('model', 'whisper-1');

    const transcript = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders()
      }
    });

    res.json({ text: transcript.data.text });
  } catch (err) {
    console.error('Transcription error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Transcription failed', detail: err.response?.data });
  }
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const {
      message,
      persona = 'default',
      tone = 'casual-direct',
      poeticLevel = 0.1,
      disfluencyLevel = 0.3,
      jobsStyleLevel = 0.25,
      volumeData = []
    } = req.body;

    const systemPrompt = persona === 'randy'
      ? `You are Randy, a wild, unfiltered motivational speaker. Be energetic, impulsive, and emotionally intense. Use casual language, filler words (\"look, you just gotta...\", \"I mean, yeah...\"), and repeat key phrases.`
      : `You are Roy, a grounded AI mentor. Speak in casual American English with about 30% real-life disfluencies (\"you know...\", \"well...\", \"I mean...\"), 10% poetic metaphor, and 25% Steve Jobs-style inspirational delivery. Avoid sounding robotic. Speak concisely. Respond in short, impactful bursts, not long speeches. You speak like a conflicted, thoughtful friend.`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });

    const replyText = response.data.choices[0].message.content;

    const audioResponse = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      voice: 'onyx',
      input: replyText
    }, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
    res.json({ text: replyText, audio: audioBase64 });
  } catch (err) {
    console.error('Chat error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Chat failed', detail: err.response?.data });
  }
});

app.listen(port, () => console.log(`Roy backend listening on port ${port}`));
