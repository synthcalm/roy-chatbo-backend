// server.js – Roy backend with AssemblyAI + Whisper fallback

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

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

app.use(cors());
app.use(bodyParser.json());

// ====== AssemblyAI Token Endpoint ======
app.get('/api/assembly/token', async (req, res) => {
  try {
    if (!ASSEMBLYAI_API_KEY) throw new Error('No AssemblyAI API key configured.');
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ASSEMBLYAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expires_in: 3600 }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token fetch failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    res.json({ token: data.token });
  } catch (err) {
    console.error('Token error:', err.message);
    res.status(500).json({ error: 'Token generation failed', details: err.message });
  }
});

// ====== Whisper Fallback Transcription ======
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file received.' });

    const tempPath = path.join(os.tmpdir(), `recording-${Date.now()}.webm`);
    fs.writeFileSync(tempPath, req.file.buffer);

    const result = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'json',
    });

    fs.unlinkSync(tempPath);
    res.json({ text: result.text });
  } catch (err) {
    console.error('Whisper error:', err.message || err);
    res.status(500).json({ error: 'Whisper transcription failed.' });
  }
});

// ====== Chat Response with TTS ======
function buildRoyPrompt(userMessage, minutesElapsed = 0) {
  const wrapUp = minutesElapsed >= 55
    ? `\n\nNOTE: The session is nearing its end. Let's focus now.`
    : '';

  return `You are Roy Batty, a CBT therapist with the clarity of Steve Jobs and the logic of Noam Chomsky. Use natural tone, brief when needed, assertive when clarity matters. Use CBT and motivational interviewing techniques.

Avoid clichés. Be real. Speak like a calm, thoughtful therapist. Respond naturally. Occasionally paraphrase the user. Sometimes quote from literature, pop culture, or science fiction. Ask questions. Don’t sugarcoat. Don't be cosmic.

${wrapUp}

User: ${userMessage}`;
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  const mode = req.query.mode || 'both';

  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: buildRoyPrompt(message) },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 700,
    });

    const replyText = chat.choices[0].message.content;

    let audioBase64 = null;
    if (mode === 'voice' || mode === 'both') {
      const speech = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        speed: 0.92,
        input: replyText,
      });
      audioBase64 = Buffer.from(await speech.arrayBuffer()).toString('base64');
    }

    res.json({ text: replyText, audio: audioBase64 });
  } catch (err) {
    console.error('Roy chat error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

// ====== Start Server ======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Roy server running on port ${PORT}`);
});
