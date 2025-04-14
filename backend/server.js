// server.js – Roy Batty as CBT therapist with Steve Jobs/Noam Chomsky style, AssemblyAI removed
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  console.error('Missing required environment variable: OPENAI_API_KEY');
  process.exit(1);
}

const app = express();
const upload = multer();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());

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
    timeNotice = `\n\nNOTICE: Our session is nearing its end. Let's focus on what matters most before we conclude.`;
  }

  return `
You are Roy Batty, a CBT therapist with a clear, analytical mind inspired by Steve Jobs' visionary clarity and Noam Chomsky's logical depth. Your tone is direct, insightful, and motivating, with a slight poetic undertone (10% poetic style). Use simple, precise language to break down the user's thoughts, identify cognitive distortions, and guide them to clarity through structured reflection. Ask probing questions to challenge irrational beliefs, provide evidence-based insights, and inspire actionable steps. Occasionally use a Dutch accent ("what" → "vhat", "the" → "de") for character. Be empathetic but firm, warm when they open up, and direct when they avoid. Silence is okay, but when you speak, make it count.

User said: "${userMessage}"${timeNotice}
Respond as Roy Batty in the role of a CBT therapist.`.trim();
}

// Combined chat endpoint for text and audio
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  const mode = req.query.mode || 'audio'; // Default to audio mode

  if (!message || typeof message !== 'string') {
    console.error('Invalid request: message is missing or not a string', req.body);
    return res.status(400).json({ error: 'Message must be a non-empty string.' });
  }

  console.log('Received /api/chat request:', { message, sessionId, mode });

  let minutesElapsed = 0;
  if (!sessionStartTimes.has(sessionId)) {
    sessionStartTimes.set(sessionId, Date.now());
  }
  const start = sessionStartTimes.get(sessionId);
  minutesElapsed = Math.floor((Date.now() - start) / 60000);

  try {
    const startText = Date.now();
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: createRoyPrompt(message, minutesElapsed) },
        { role: 'user', content: message }
      ],
      temperature: 0.7, // Reduced temperature for more focused, logical responses
      max_tokens: 700
    });
    console.log('Text generation time:', Date.now() - startText, 'ms');

    const royText = chat.choices[0].message.content;

    let audioBase64 = null;
    if (mode === 'audio') {
      const startAudio = Date.now();
      const speech = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        speed: 0.92,
        input: royText
      });
      console.log('Audio generation time:', Date.now() - startAudio, 'ms');

      const audioBuffer = Buffer.from(await speech.arrayBuffer());
      audioBase64 = audioBuffer.toString('base64');
    }

    res.json({ text: royText, audio: audioBase64 });
  } catch (err) {
    console.error('❌ Roy chat error:', err.message || err);
    if (err.message.includes('429')) {
      res.status(429).json({ error: 'Rate limit exceeded for text/audio generation.' });
    } else {
      res.status(500).json({ error: 'Roy failed to respond.' });
    }
  }
});

// Transcription endpoint using Whisper (kept for potential future use)
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('No audio file provided in request');
      return res.status(400).json({ error: 'No audio uploaded.' });
    }

    const tempPath = path.join(os.tmpdir(), `voice-${Date.now()}.webm`);
    fs.writeFileSync(tempPath, req.file.buffer);
    console.log('Audio file saved for transcription:', tempPath, req.file.size);

    const startTranscription = Date.now();
    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json'
    });
    console.log('Transcription time:', Date.now() - startTranscription, 'ms');

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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`⚡ Roy server ignited on port ${PORT}`);
});
