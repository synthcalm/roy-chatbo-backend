// server.js
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

app.use(cors({
  origin: ['https://synthcalm.com', 'https://synthcalm.github.io']
}));

app.use(express.json());

// Transcription route (unchanged)
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
          'content-type': 'application/json',
        }
      }
    );

    const transcriptId = transcriptRes.data.id;

    let completed = false;
    let text = '';
    while (!completed) {
      const pollingRes = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: { authorization: ASSEMBLY_API_KEY }
        }
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

// Chat Route (Updated with AssemblyAI TTS)
app.post('/api/chat', async (req, res) => {
  const { message, persona } = req.body;

  let responseText = '';
  let responseAudio = '';

  try {
    // Roy's response logic
    if (persona === 'roy') {
      responseText = `Okay, here's my response to: "${message}"`;

      // Call AssemblyAI TTS API to generate audio
      const ttsRes = await axios.post(
        'https://api.assemblyai.com/v2/tts', // Hypothetical TTS endpoint; check AssemblyAI docs for exact endpoint
        {
          text: responseText,
          voice: 'en_us_male', // Specify a voice (check AssemblyAI docs for available voices)
        },
        {
          headers: {
            authorization: ASSEMBLY_API_KEY,
            'content-type': 'application/json',
          },
          responseType: 'arraybuffer', // Get raw audio data
        }
      );

      // Convert the audio buffer to base64
      responseAudio = Buffer.from(ttsRes.data).toString('base64');
    } else if (persona === 'randy') {
      responseText = `Randy: You said: "${message}"`;
      // Add TTS for Randy if desired
      responseAudio = '';
    }

    res.json({
      text: responseText,
      audio: responseAudio,
    });
  } catch (err) {
    console.error('[TTS Error]', err);
    res.status(500).json({ error: 'Failed to generate audio response' });
  }
});

app.get('/', (req, res) => {
  res.send('Roy Chatbot Backend Running');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
