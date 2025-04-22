// server.js with /api/chat and /api/transcribe routes fully wired

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
require('dotenv').config();

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;
const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors({
  origin: ['https://synthcalm.com', 'https://synthcalm.github.io']
}));

app.use(express.json());

// /api/chat route
app.post('/api/chat', async (req, res) => {
  const { message, persona } = req.body;
  if (!message || !persona) return res.status(400).json({ error: 'Missing input' });

  const systemPrompt = persona === 'roy'
    ? `
You are Roy, a thoughtful, witty, and emotionally grounded therapist.
You speak like a wise friend at 2 AM — calm, clear, and present.
You use contractions, never speak in academic jargon, and occasionally say "ain’t" or "man" when it feels real.
Your responses are short, emotionally impactful, and may include subtle pop culture references.
Never condescending. Never robotic. Avoid clichés. Reframe pain with dignity and gentle humor.
    `
    : `You are Randy. You’re blunt, chaotic, and speak like a Gen Z internet therapist with a rebellious streak. You cut to the chase but never mock pain.`;

  try {
    const completion = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const reply = completion.data.choices[0].message.content;

    const tts = await axios.post(
      'https://api.openai.com/v1/audio/speech',
      {
        model: 'tts-1',
        input: reply,
        voice: persona === 'roy' ? 'onyx' : 'fable',
        response_format: 'mp3'
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    const audioBase64 = Buffer.from(tts.data).toString('base64');
    res.json({ text: reply, audio: audioBase64 });
  } catch (err) {
    console.error('[Roy Chat Error]', err);
    res.status(500).json({ error: 'Failed to generate reply' });
  }
});

// /api/transcribe route
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

  const convertedPath = path.join(__dirname, 'uploads', `${req.file.filename}-converted.wav`);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(req.file.path)
        .audioCodec('pcm_s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', resolve)
        .on('error', reject)
        .save(convertedPath);
    });

    const audioData = fs.readFileSync(convertedPath);
    const uploadRes = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audioData,
      {
        headers: {
          'authorization': ASSEMBLY_API_KEY,
          'content-type': 'audio/wav',
          'transfer-encoding': 'chunked'
        }
      }
    );

    const audioUrl = uploadRes.data.upload_url;

    const transcriptRes = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      { audio_url: audioUrl },
      {
        headers: {
          authorization: ASSEMBLY_API_KEY,
          'content-type': 'application/json'
        }
      }
    );

    const transcriptId = transcriptRes.data.id;

    let completed = false;
    let text = '';
    while (!completed) {
      const pollingRes = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        { headers: { authorization: ASSEMBLY_API_KEY } }
      );

      if (pollingRes.data.status === 'completed') {
        completed = true;
        text = pollingRes.data.text;
      } else if (pollingRes.data.status === 'error') {
        return res.status(500).json({ error: 'AssemblyAI transcription error' });
      } else {
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    res.json({ text });

  } catch (err) {
    console.error('[Transcription Error]', err);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  } finally {
    fs.unlink(req.file.path, () => {});
    fs.unlink(convertedPath, () => {});
  }
});

app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
