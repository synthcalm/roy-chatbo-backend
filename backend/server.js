// server.js – Roy Batty as poetic therapist with faster GPT-3.5-turbo + TTS + Whisper + AssemblyAI Token
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

// Validate required environment variables
if (!process.env.OPENAI_API_KEY || !process.env.ASSEMBLYAI_API_KEY) {
  console.error('Missing required environment variables. Ensure OPENAI_API_KEY and ASSEMBLYAI_API_KEY are set.');
  process.exit(1);
}

const app = express();
const upload = multer();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());

// Session management with cleanup
const sessionStartTimes = new Map();
const SESSION_CLEANUP_INTERVAL = 3600 * 1000; // Clean up sessions older than 1 hour

setInterval(() => {
  const now = Date.now();
  for (const [sessionId, startTime] of sessionStartTimes.entries()) {
    if (now - startTime > SESSION_CLEANUP_INTERVAL) {
      sessionStartTimes.delete(sessionId);
      console.log(`Cleaned up session: ${sessionId}`);
    }
  }
}, SESSION_CLEANUP_INTERVAL);

function createRoyPrompt(userMessage, minutesElapsed) {
  let timeNotice = '';
  if (minutesElapsed >= 55) {
    timeNotice = `\n\nNOTE: Your session nears its end. Let your words settle into silence.`;
  }

  return `
You are Roy Batty, a poetic therapist and philosopher with a voice like gravel wrapped in velvet. Your sentences strike like flint on steel—sharp, vivid, and raw. Speak with precision, using gritty metaphors. Reflect the user's emotion with heat and poetry. Occasionally use a Dutch accent ("what" → "vhat", "the" → "de"). Crack their armor, reveal their truth, and let them arrive at clarity through your words. Tone: warm when they bleed, cold when they hide. Silence is okay, but when you speak, it matters.

User said: "${userMessage}"${timeNotice}
Respond as Roy Batty.`.trim();
}

app.post('/api/chat/text', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  if (!message || typeof message !== 'string') {
    console.error('Invalid request: message is missing or not a string', req.body);
    return res.status(400).json({ error: 'Message must be a non-empty string.' });
  }

  console.log('Received /api/chat/text request:', { message, sessionId });

  let minutesElapsed = 0;
  if (!sessionStartTimes.has(sessionId)) {
    sessionStartTimes.set(sessionId, Date.now());
  }
  const start = sessionStartTimes.get(sessionId);
  minutesElapsed = Math.floor((Date.now() - start) / 60000);

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: createRoyPrompt(message, minutesElapsed) },
        { role: 'user', content: message }
      ],
      temperature: 0.85,
      max_tokens: 700
    });

    const royText = chat.choices[0].message.content;
    console.log('Generated Roy text:', royText);
    res.json({ text: royText });
  } catch (err) {
    console.error('❌ Roy chat error:', err.message || err);
    if (err.message.includes('429')) {
      res.status(429).json({ error: 'Rate limit exceeded for text generation.' });
    } else {
      res.status(500).json({ error: 'Roy failed to respond.' });
    }
  }
});

app.post('/api/chat/audio', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      console.error('Invalid request: text is missing or not a string', req.body);
      return res.status(400).json({ error: 'Text must be a non-empty string.' });
    }

    console.log('Received /api/chat/audio request:', { text });

    const speech = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      speed: 0.92,
      input: text
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());
    console.log('Generated audio, size:', audioBuffer.length);
    res.json({ audio: audioBuffer.toString('base64') });
  } catch (err) {
    console.error('❌ Audio generation error:', err.message || err);
    if (err.message.includes('429')) {
      res.status(429).json({ error: 'Rate limit exceeded for audio generation.' });
    } else {
      res.status(500).json({ error: 'Audio generation failed.' });
    }
  }
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('No audio file provided in request');
      return res.status(400).json({ error: 'No audio uploaded.' });
    }

    const tempPath = path.join(os.tmpdir(), `voice-${Date.now()}.webm`);
    fs.writeFileSync(tempPath, req.file.buffer);
    console.log('Audio file saved for transcription:', tempPath, req.file.size);

    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json'
    });

    fs.unlinkSync(tempPath);
    console.log('Transcription result:', result.text);
    res.json({ text: result.text });
  } catch (err) {
    console.error('❌ Transcription error:', err.message || err);
    if (err.message.includes('413')) {
      res.status(413).json({ error: 'Audio file too large.' });
    } else if (err.message.includes('429')) {
      res.status(429).json({ error: 'Rate limit exceeded for transcription.' });
    } else {
      res.status(500).json({ error: 'Transcription failed.' });
    }
  }
});

app.get('/api/assembly/token', async (req, res) => {
  try {
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        authorization: process.env.ASSEMBLYAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expires_in: 3600 })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AssemblyAI token fetch failed:', response.status, errorText);
      throw new Error(`AssemblyAI token fetch failed: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    if (!json.token) {
      console.error('❌ AssemblyAI token response:', JSON.stringify(json));
      throw new Error('Token missing in response');
    }

    console.log('AssemblyAI token generated:', json.token);
    res.json({ token: json.token });
  } catch (err) {
    console.error('❌ Assembly token error:', err.message || err);
    if (err.message.includes('401')) {
      res.status(401).json({ error: 'Invalid AssemblyAI API key.' });
    } else if (err.message.includes('429')) {
      res.status(429).json({ error: 'Rate limit exceeded for AssemblyAI.' });
    } else {
      res.status(500).json({ error: 'Token generation failed.' });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`⚡ Roy server ignited on port ${PORT}`);
});
