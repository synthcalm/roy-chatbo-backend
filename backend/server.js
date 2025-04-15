// server.js – Roy backend using Whisper for transcription only

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { OpenAI } = require('openai');

const app = express();
const upload = multer();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// === SESSION TRACKING ===
const sessionStartTimes = new Map();

// === CHAT ENDPOINT ===
function createRoyPrompt(userMessage, minutesElapsed) {
  const timeNote = minutesElapsed >= 55
    ? `\n\nNOTICE: We're nearing the end of this session. Focus on what matters.`
    : '';

  return `
You are Roy Batty, a therapist who blends CBT and existential insight with the directness of Steve Jobs. Use probing questions, minimal fluff, 60% reflective affirmations, and occasional paraphrasing. Stay sharp and real, without being overly poetic.

User said: "${userMessage}"${timeNote}

Now respond as Roy.`.trim();
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default-session', mode = 'both' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  if (!sessionStartTimes.has(sessionId)) {
    sessionStartTimes.set(sessionId, Date.now());
  }

  const minutesElapsed = Math.floor((Date.now() - sessionStartTimes.get(sessionId)) / 60000);

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: createRoyPrompt(message, minutesElapsed) },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const royText = chat.choices[0].message.content;

    let audioBase64 = null;
    if (mode === 'voice' || mode === 'both') {
      const audio = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        speed: 0.92,
        input: royText
      });
      const buffer = Buffer.from(await audio.arrayBuffer());
      audioBase64 = buffer.toString('base64');
    }

    res.json({ text: royText, audio: audioBase64 });
  } catch (err) {
    console.error('Roy chat error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

// === TRANSCRIPTION ENDPOINT ===
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio uploaded' });

    const tempPath = path.join(os.tmpdir(), `recording-${Date.now()}.webm`);
    fs.writeFileSync(tempPath, req.file.buffer);

    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json'
    });

    fs.unlinkSync(tempPath);
    res.json({ text: result.text });
  } catch (err) {
    console.error('Transcription error:', err.message || err);
    res.status(400).json({ error: 'Transcription failed.' });
  }
});

// === START SERVER ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Roy server running on port ${PORT}`);
});
