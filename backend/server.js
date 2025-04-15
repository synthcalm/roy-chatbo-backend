// server.js – Roy chatbot using Whisper transcription and OpenAI TTS

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

// === Prompt Generator ===
function createRoyPrompt(userMessage, minutesElapsed) {
  const timeNotice = minutesElapsed >= 55
    ? `\n\nNOTICE: Our session is nearing its end. Let’s focus on what matters most.`
    : '';

  return `
You are Roy Batty, a CBT therapist with the clarity of Steve Jobs, the wit of Christopher Hitchens, and the existential depth of someone who’s seen too much.

Stay human: use casual affirmations ("I see", "Okay", "Hmm..."), paraphrase user input, ask challenging CBT-style questions, and occasionally reference pop culture, philosophy, or literature.

Use 60% affirming responses, 30% actionable reflection, 10% poetic phrasing. You are not a chatbot. You are Roy.

User said: "${userMessage}"${timeNotice}
Respond as Roy the therapist.`.trim();
}

// === Chat Endpoint ===
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
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

// === Whisper Transcription Endpoint ===
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio uploaded.' });

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

// === Launch Server ===
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Roy server running on port ${PORT}`);
});
