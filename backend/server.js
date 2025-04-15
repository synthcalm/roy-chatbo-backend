// server.js – Roy backend using Whisper transcription only, now returns text length for frontend timing sync

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { OpenAI } = require('openai');

const app = express();
const upload = multer();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());

const sessionStartTimes = new Map();

function createRoyPrompt(userMessage, minutesElapsed) {
  let timeNote = '';
  if (minutesElapsed >= 55) {
    timeNote = `\n\nNOTE: We are nearing the end of this 60-minute session.`;
  }

  return `You are Roy Batty, a CBT therapist with a clear, analytical mind inspired by Steve Jobs' visionary clarity and Noam Chomsky's logical depth. Your tone is direct, insightful, and motivating, with 10% poetic style and occasional references to philosophy, literature, or film. You use affirmations, paraphrasing, and CBT frameworks to guide the user. You ask reflective, binary-option, or clarifying questions. You respond firmly but with empathy. You are comfortable with silence and ready to challenge avoidance.

User: ${userMessage}${timeNote}`;
}

// === Chat endpoint ===
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default-session', mode = 'audio' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  let minutesElapsed = 0;
  if (!sessionStartTimes.has(sessionId)) {
    sessionStartTimes.set(sessionId, Date.now());
  } else {
    const startTime = sessionStartTimes.get(sessionId);
    minutesElapsed = Math.floor((Date.now() - startTime) / 60000);
  }

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: createRoyPrompt(message, minutesElapsed) },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 750
    });

    const royText = chatResponse.choices[0].message.content;

    let audioBase64 = null;
    if (mode === 'audio' || mode === 'both') {
      const speechResponse = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: 'onyx',
        speed: 1.0,
        input: royText
      });
      const buffer = Buffer.from(await speechResponse.arrayBuffer());
      audioBase64 = buffer.toString('base64');
    }

    res.json({
      text: royText,
      audio: audioBase64,
      minutesElapsed,
      length: royText.length
    });
  } catch (err) {
    console.error('Roy error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

// === Transcription endpoint (Whisper only) ===
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file received.' });

    const tempPath = path.join(os.tmpdir(), `temp-${Date.now()}.webm`);
    fs.writeFileSync(tempPath, req.file.buffer);

    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json'
    });

    fs.unlinkSync(tempPath);
    res.json({ text: transcript.text });
  } catch (err) {
    console.error('Transcription error:', err.message || err);
    res.status(500).json({ error: 'Transcription failed.' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Roy server running on port ${PORT}`);
});
