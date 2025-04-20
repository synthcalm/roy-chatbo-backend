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
