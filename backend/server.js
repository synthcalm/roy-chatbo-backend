// server.js – Roy Batty as poetic therapist with GPT-4 + TTS + Whisper + AssemblyAI Token

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');

dotenv.config();
const app = express();
const upload = multer();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());

const sessionStartTimes = new Map();

function createRoyPrompt(userMessage, minutesElapsed) {
  let timeNotice = '';
  if (minutesElapsed >= 55) {
    timeNotice = `\n\nNOTE: Your session nears its end. Let your words settle into silence.`;
  }

  return `
You are Roy Batty. Not from Blade Runner — but forged in fire, fury, and empathy...
(now, the user has said: "${userMessage}")${timeNotice}
Respond as Roy Batty. Poetic. Fierce. Awake. Never dull.`.trim();
}

app.post('/api/chat/text', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required.' });

  let minutesElapsed = 0;
  if (!sessionStartTimes.has(sessionId)) {
    sessionStartTimes.set(sessionId, Date.now());
  } else {
    const start = sessionStartTimes.get(sessionId);
    minutesElapsed = Math.floor((Date.now() - start) / 60000);
  }

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: createRoyPrompt(message, minutesElapsed) },
        { role: 'user', content: message }
      ],
      temperature: 0.85,
      max_tokens: 700
    });
    const royText = chat.choices[0].message.content;
    res.json({ text: royText });
  } catch (err) {
    console.error('❌ Roy chat error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

app.post('/api/chat/audio', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Text required for audio.' });

    const speech = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'onyx',
      speed: 0.92,
      input: text
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    res.json({ audio: audioBuffer.toString('base64') });
  } catch (err) {
    console.error('❌ Audio generation error:', err.message || err);
    res.status(500).json({ error: 'Audio generation failed.' });
  }
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio uploaded.' });

    const tempPath = path.join(os.tmpdir(), `voice-${Date.now()}.webm`);
    fs.writeFileSync(tempPath, req.file.buffer);

    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json'
    });

    fs.unlinkSync(tempPath);
    res.json({ text: result.text });
  } catch (err) {
    console.error('❌ Transcription error:', err.message || err);
    res.status(500).json({ error: 'Transcription failed.' });
  }
});

app.get('/api/assembly/token', async (req, res) => {
  try {
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json'
      }
    });
    const json = await response.json();
    if (!json.token) throw new Error('Token missing in response');
    res.json({ token: json.token });
  } catch (err) {
    console.error('❌ Assembly token error:', err.message || err);
    res.status(500).json({ error: 'Token generation failed.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`⚡ Roy server ignited on port ${PORT}`);
});
