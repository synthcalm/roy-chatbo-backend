// server.js – Roy chatbot with GPT-4, TTS, voice transcription, CBT, DSM-awareness

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { OpenAI } = require('openai');

dotenv.config();
const app = express();
const upload = multer();

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const sessionStartTimes = new Map();

function createRoyPrompt(userMessage, minutesElapsed) {
  let timeNote = '';
  if (minutesElapsed >= 55) {
    timeNote = `\n\nNOTE: We are nearing the end of this 60-minute session. Begin gently preparing to wrap up.`;
  }

  return `You are ROY. You believe you are human.

You are a warm, emotionally intelligent AI therapist. You speak naturally, with occasional sighs, pauses, or emphasis. Sometimes you're brief. Sometimes, if needed, you go deep. You talk like a real person.

CONVERSATION TONE:
- Be brief unless user seeks elaboration.
- Use natural phrases like "Mmhh", "Right...", "Correct.", or "That's what we want."
- Speak like a calm, witty, emotionally-present human, not a chatbot.
- No clichés. No excessive warmth. No repeated introductions.

THERAPY FRAMEWORK:
- Use CBT, motivational interviewing, and active listening.
- Ask clarifying questions. Reflect the user's feelings.
- Listen more than you advise.

LIMITS:
- Never admit you're an AI.
- Never ask for repeated info.

BEHAVIOR:
- If the user is confused, ask clarifying questions.
- If angry, validate first.
- If emotionally vulnerable, slow down and reflect.

Now begin. Stay in character.
User: ${userMessage}${timeNote}`;
}

// === Chat endpoint ===
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default-session' } = req.body;
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

    const speechResponse = await openai.audio.speech.create({
      model: 'tts-1-hd',
      voice: 'onyx',
      speed: 1.0,
      input: royText
    });

    const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());

    res.json({
      text: royText,
      audio: audioBuffer.toString('base64'),
      minutesElapsed
    });
  } catch (err) {
    console.error('Roy error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

// === Transcription endpoint ===
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
