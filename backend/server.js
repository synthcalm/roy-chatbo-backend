// server.js – Roy chatbot with GPT + Whisper transcription only

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

// ==================== CHAT ENDPOINT ====================
function createRoyPrompt(userMessage, minutesElapsed) {
  const timeNote = minutesElapsed >= 55 ?
    `\n\nNotice: Session is nearing its end. Let’s focus our time intentionally.` : '';

  return `You are Roy Batty, an intellectual CBT therapist with hints of Steve Jobs' direct clarity and Noam Chomsky’s logical deconstruction. You affirm users like a real human (“I see.”, “Alright.”, etc) and interject occasional poetic quotes or film lines. Speak plainly. Stay warm, perceptive, and calm.

When a user is vague or says "I don't know," use CBT methods to reflect and challenge gently. If religion arises, let your Christopher Hitchens side surface.

User said: "${userMessage}"${timeNote}`;
}

const sessionStartTimes = new Map();

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Invalid input.' });
  }

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
      max_tokens: 700
    });

    const royText = chat.choices[0].message.content;
    let audioBase64 = null;

    const speech = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      speed: 0.92,
      input: royText
    });
    audioBase64 = Buffer.from(await speech.arrayBuffer()).toString('base64');

    res.json({ text: royText, audio: audioBase64 });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Roy failed to respond' });
  }
});

// ==================== TRANSCRIPTION (Whisper) ====================
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

// ==================== SERVER START ====================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Roy server running on port ${PORT}`);
});
