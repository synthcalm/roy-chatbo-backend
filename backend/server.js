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
      contentType: 'audio/webm',
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
    console.error('Transcription error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;
    const persona = req.body.persona || 'default';

    const prompt = persona === 'randy'
      ? `You're Randy, an unfiltered, wild motivational speaker with edge. Respond to: ${userMessage}`
      : `You are Roy, a poetic, philosophical assistant. Respond with wit and insight. User said: ${userMessage}`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });

    const replyText = response.data.choices[0].message.content;

    // Get speech from OpenAI TTS
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
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat failed' });
  }
});

app.listen(port, () => console.log(`Roy backend listening on port ${port}`));
