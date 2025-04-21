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

// POST /api/chat — handles audio upload, transcription, GPT-4 response, and TTS
app.post('/api/chat', upload.single('audio'), async (req, res) => {
  try {
    const bot = req.body.bot || 'roy';
    const fileBuffer = req.file?.buffer;

    if (!fileBuffer) {
      return res.status(400).json({ error: 'Audio file missing' });
    }

    // 1. Transcribe audio using Whisper
    const form = new FormData();
    form.append('file', fileBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    form.append('model', 'whisper-1');

    const transcriptRes = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders()
      }
    });

    const message = transcriptRes.data.text;
    console.log(`[TRANSCRIBE] "${message}"`);

    // 2. Create system prompt based on bot
    const systemPrompt = bot === 'randy'
      ? `You are Randy, an unfiltered, intense speaker who sounds like a cross between a renegade poet and a street prophet. Speak in gritty, cinematic language. Channel a raw, prophetic tone like the 'tears in rain' monologue. No sugar-coating. Punch hard with words. Keep your style 60% film noir, 40% urgent reality. Every reply should feel like the final scene of a cult movie. After each rant, check in on the user—ask how they’re doing, reflect on what they just shared, and wrap up with a tough-love coach insight that helps them reframe or refocus.`
      : `You are Roy, a grounded AI mentor. Speak in casual American English with about 30% real-life disfluencies ("you know...", "well...", "I mean..."), 10% poetic metaphor, and 25% insightful cultural references. Avoid quoting Steve Jobs. Instead, use quotes or ideas from Middle Eastern poets, timeless lyrics, or reflective lines from sci-fi characters like Roy Batty. Speak in short, impactful bursts, not long speeches. You speak like a conflicted, thoughtful friend.`;

    // 3. Get response from GPT-4
    const chatRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });

    const replyText = chatRes.data.choices[0].message.content;
    console.log(`[REPLY] ${replyText}`);

    // 4. Convert reply to audio (TTS)
    const ttsRes = await axios.post('https://api.openai.com/v1/audio/speech', {
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

    const audioBase64 = Buffer.from(ttsRes.data).toString('base64');
    res.json({ text: replyText, audio: audioBase64 });

  } catch (err) {
    console.error('Chat route error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Chat route failed', detail: err.response?.data || err.message });
  }
});

app.listen(port, () => {
  console.log(`✅ Roy backend running on port ${port}`);
});
