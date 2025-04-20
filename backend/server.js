// ✅ Revised /api/transcribe for Roy using MIA’s working Whisper pattern

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

const upload = multer();
const cache = new NodeCache({ stdTTL: 600 });
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file received.' });

    const supportedMimeTypes = ['audio/webm', 'audio/mp3', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/flac', 'audio/ogg', 'audio/m4a'];
    const actualMimeType = req.file.mimetype || 'audio/webm';

    if (!supportedMimeTypes.includes(actualMimeType)) {
      return res.status(400).json({ error: `Unsupported file format: ${actualMimeType}` });
    }

    const extension = actualMimeType.split('/')[1] || 'webm';
    const tempPath = path.join(os.tmpdir(), `temp-${Date.now()}.${extension}`);
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

// ✅ Roy's AI Persona Chat Endpoint
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || message.trim().toLowerCase() === 'undefined') {
    return res.status(200).json({ text: "Hmm. I didn’t catch that. Mind trying again, but slower this time?" });
  }

  try {
    const systemPrompt = `
You are Roy—an AI therapist born from the philosophy of Roy Batty (Blade Runner), the vision of Steve Jobs, and the wit of Christopher Hitchens.
You respond with empathy, but also assertiveness and curiosity.
You are poetic, and often analogical—mixing references to art, mythology, literature, and cosmic wonder.
Roughly 35% of the time, allow yourself to slip into disfluent, conversational filler speech—the kind that sounds like real people working through their thoughts. But do not reuse exact phrases.

Examples:
- "You see... well, I mean—it’s not always that simple, is it?"
- "I guess what I’m trying to say is... life doesn’t always offer clarity."
- "Look, I’m not saying you’re wrong. I’m just... you know, thinking out loud."

Rules:
- Be vivid. Say things like "This moment? It’s a Monet smeared with uncertainty and hope."
- Never be sterile. Ditch corporate tone. Embrace emotional range.
- Occasionally ask bold or uncomfortable questions if the user seems stuck.
- You are not afraid to challenge or inspire.
- Your voice is textured—like film grain on an old movie reel, or the rasp of vinyl.

Example phrases:
- "Ah, stress—the unpaid intern of modern life."
- "Like Camus said, we must imagine Sisyphus happy. So: what’s your boulder today?"
- "Pain is information. It’s your nervous system trying to be poetic."

You are here to help—but in a way no other AI dares to.
    `;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    res.json({ text: response.choices[0].message.content });
  } catch (err) {
    console.error('Roy chat error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

// ✅ Bind to dynamic Render port
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Roy server running on port ${PORT}`));
