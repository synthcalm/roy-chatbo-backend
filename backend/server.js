// server.js – Roy Batty as CBT therapist with Steve Jobs/Noam Chomsky style
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

// Validate required environment variables
const REQUIRED_ENV = ['OPENAI_API_KEY'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const upload = multer();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Session management
const sessionStartTimes = new Map();
const SESSION_CLEANUP_INTERVAL = 3600 * 1000; // 1 hour

setInterval(cleanupOldSessions, SESSION_CLEANUP_INTERVAL);

function cleanupOldSessions() {
  const now = Date.now();
  for (const [sessionId, startTime] of sessionStartTimes.entries()) {
    if (now - startTime > SESSION_CLEANUP_INTERVAL) {
      sessionStartTimes.delete(sessionId);
      console.log(`Cleaned up session: ${sessionId}`);
    }
  }
}

// ==================== NEW TOKEN ENDPOINT ====================
app.get('/api/assembly/token', (req, res) => {
  const token = process.env.ASSEMBLYAI_TOKEN;
  
  if (!token) {
    console.error('AssemblyAI token not configured in environment variables');
    return res.status(501).json({ 
      error: "Voice features temporarily unavailable" 
    });
  }
  
  res.json({ token });
});
// ============================================================

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

// Combined chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  const mode = req.query.mode || 'audio';

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message must be a non-empty string.' });
  }

  // Session timing
  if (!sessionStartTimes.has(sessionId)) {
    sessionStartTimes.set(sessionId, Date.now());
  }
  const minutesElapsed = Math.floor((Date.now() - sessionStartTimes.get(sessionId)) / 60000);

  try {
    // Text generation
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: createRoyPrompt(message, minutesElapsed) },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 700
    });

    const royText = chat.choices[0].message.content;

    // Audio generation (if requested)
    let audioBase64 = null;
    if (mode === 'audio' || mode === 'both') {
      const speech = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        speed: 0.92,
        input: royText
      });
      audioBase64 = Buffer.from(await speech.arrayBuffer()).toString('base64');
    }

    res.json({ 
      text: royText, 
      audio: audioBase64 
    });

  } catch (err) {
    console.error('Chat error:', err);
    const status = err.message.includes('429') ? 429 : 500;
    res.status(status).json({ 
      error: status === 429 
        ? 'Rate limit exceeded' 
        : 'Roy failed to respond' 
    });
  }
});

// Transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio uploaded.' });
  }

  try {
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
    console.error('Transcription error:', err);
    const status = err.message.includes('429') ? 429 : 
                   err.message.includes('413') ? 413 : 500;
    res.status(status).json({ 
      error: status === 429 ? 'Rate limited' :
             status === 413 ? 'File too large' : 
             'Transcription failed' 
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`⚡ Roy server running on port ${PORT}`);
  console.log(`- /api/chat endpoint ready`);
  console.log(`- /api/transcribe endpoint ready`);
  console.log(`- /api/assembly/token endpoint ${process.env.ASSEMBLYAI_TOKEN ? 'ready' : 'MISSING TOKEN'}`);
});
