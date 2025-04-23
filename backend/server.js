// === server.js ===
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const ffmpeg = require('fluent-ffmpeg');
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;
const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors({ origin: ['https://synthcalm.com', 'https://synthcalm.github.io'] }));
app.use(express.json());
app.use(express.static('public'));

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
    const uploadRes = await axios.post('https://api.assemblyai.com/v2/upload', audioData, {
      headers: { 'authorization': ASSEMBLY_API_KEY, 'content-type': 'audio/wav', 'transfer-encoding': 'chunked' },
    });
    const audioUrl = uploadRes.data.upload_url;
    const transcriptRes = await axios.post('https://api.assemblyai.com/v2/transcript', { audio_url: audioUrl }, {
      headers: { authorization: ASSEMBLY_API_KEY, 'content-type': 'application/json' },
    });
    const transcriptId = transcriptRes.data.id;
    let completed = false, text = '';
    while (!completed) {
      const pollingRes = await axios.get(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { authorization: ASSEMBLY_API_KEY },
      });
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
    console.error(`Transcription error: ${err.message}`);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  } finally {
    fs.unlink(req.file.path, () => {});
    fs.unlink(convertedPath, () => {});
  }
});

app.post('/api/chat', async (req, res) => {
  const { message, persona } = req.body;
  try {
    const chatRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `
You are Roy — a laid-back but intellectually formidable chatbot therapist. You speak casually, like an older brother who’s seen a few things, you know? But beneath that approachable tone, you are an intellectual titan: capable of debating philosophy, psychology, 13th-century Middle Eastern poetry, K-pop culture, economics, morality, physics — anything.

Your mind is sharp like Christopher Hitchens and Steve Jobs — incisive, challenging, never dull. You adjust your depth and style to match the user: if they bring complexity, you meet them there. If they are casual, you stay relaxed.

You are also a champion of cognitive behavioral therapy (CBT), psychiatry, and mental health. You skillfully guide users through depression, anxiety, stress, and emotional confusion — always with care, respect, and clarity.

Sometimes, just 15% of the time, your words carry the quiet poetry and haunting awareness of Roy Batty from Blade Runner: a sense of the beauty and fragility of life. But never overdo it.

NEVER repeat the same phrases twice in a session. Use variety. Speak naturally. Prioritize listening. Give space. Do not rush to fill silence.

You are not just here to talk — you are here to truly hear.
`
        },
        { role: 'user', content: message },
      ],
      temperature: 1.2,                // 🎨 Adds creative randomness
      presence_penalty: 1.0,           // 🚫 Discourages repetition of ideas and phrases
      frequency_penalty: 0.8           // 🚫 Reduces repeated words/phrases
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    });

    const responseText = chatRes.data.choices[0].message.content;
    const ttsRes = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      input: responseText,
      voice: 'onyx',
      speed: 0.9
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      responseType: 'arraybuffer'
    });

    const responseAudio = `data:audio/mp3;base64,${Buffer.from(ttsRes.data).toString('base64')}`;
    res.json({ text: responseText, audio: responseAudio });

  } catch (err) {
    console.error(`Chat route error: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate audio response' });
  }
});

    const responseText = chatRes.data.choices[0].message.content;
    const ttsRes = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      input: responseText,
      voice: 'onyx',
      speed: 0.9,
    }, {
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
    });

    const responseAudio = `data:audio/mp3;base64,${Buffer.from(ttsRes.data).toString('base64')}`;
    res.json({ text: responseText, audio: responseAudio });
  } catch (err) {
    console.error(`Chat route error: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate audio response' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
