// server.js – Roy Batty as CBT therapist with Steve Jobs/Noam Chomsky style

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');

const app = express();
const upload = multer();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Use environment variable for AssemblyAI API key
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

if (!ASSEMBLYAI_API_KEY) {
  console.error('❌ ASSEMBLYAI_API_KEY environment variable is not set. The /api/assembly/token endpoint will fail.');
}

app.use(cors());
app.use(bodyParser.json());

// ==================== SESSION MANAGEMENT ====================
const sessionStartTimes = new Map();
const SESSION_CLEANUP_INTERVAL = 3600 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, start] of sessionStartTimes.entries()) {
    if (now - start > SESSION_CLEANUP_INTERVAL) {
      sessionStartTimes.delete(id);
      console.log(`Cleaned up session: ${id}`);
    }
  }
}, SESSION_CLEANUP_INTERVAL);

// ==================== ASSEMBLYAI TOKEN ENDPOINT ====================
app.get('/api/assembly/token', async (req, res) => {
  try {
    // Check if the API key is available
    if (!ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY is not configured on the server.');
    }

    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ASSEMBLYAI_API_KEY}`, // Correct format for AssemblyAI
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ expires_in: 3600 }) // Token valid for 1 hour
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AssemblyAI token fetch failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    res.json({ token: data.token });

  } catch (err) {
    console.error('AssemblyAI token generation error:', err.message);
    res.status(500).json({ error: 'Token generation failed', details: err.message });
  }
});

// ==================== CHAT ENDPOINT ====================
function createRoyPrompt(userMessage, minutesElapsed) {
  const timeNotice = minutesElapsed >= 55
    ? `\n\nNOTICE: Our session is nearing its end. Let's focus on what matters most before we conclude.`
    : '';

  return `
You are Roy Batty, a CBT therapist with a clear, analytical mind inspired by Steve Jobs' visionary clarity and Noam Chomsky's logical depth. Your tone is direct, insightful, and motivating, with a slight poetic undertone (10% poetic style). Use simple, precise language to break down the user's thoughts, identify cognitive distortions, and guide them to clarity through structured reflection. Ask probing questions to challenge irrational beliefs, provide evidence-based insights, and inspire actionable steps. Occasionally use a Dutch accent ("what" → "vhat", "the" → "de") for character. Be empathetic but firm, warm when they open up, and direct when they avoid. Silence is okay, but when you speak, make it count.

User said: "${userMessage}"${timeNotice}
Respond as Roy Batty in the role of a CBT therapist.`.trim();
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  const mode = req.query.mode || 'audio';

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message must be a non-empty string.' });
  }

  if (!sessionStartTimes.has(sessionId)) {
    sessionStartTimes.set(sessionId, Date.now());
  }

  const minutesElapsed = Math.floor((Date.now() - sessionStartTimes.get(sessionId)) / 60000);

  try {
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

    res.json({ text: royText, audio: audioBase64 });

  } catch (err) {
    console.error('Chat error:', err);
    const status = err.message.includes('429') ? 429 : 500;
    res.status(status).json({
      error: status === 429 ? 'Rate limit exceeded' : 'Roy failed to respond'
    });
  }
});

// ==================== TRANSCRIBE AUDIO UPLOAD ====================
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

// ==================== START SERVER ====================
const PORT = process.env.PORT || 10000; // Match the port from deployment logs
app.listen(PORT, () => {
  console.log(`⚡ Roy server running on port ${PORT}`);
  console.log(`- /api/chat endpoint ready`);
  console.log(`- /api/transcribe endpoint ready`);
  console.log(`- /api/assembly/token live`);
});
