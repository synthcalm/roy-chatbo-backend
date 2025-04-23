const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const ffmpeg = require('fluent-ffmpeg');
require('dotenv').config();

// Set FFmpeg path to Render's system FFmpeg with error handling
try {
  const ffmpegPath = '/usr/bin/ffmpeg';
  if (fs.existsSync(ffmpegPath)) {
    ffmpeg.setFfmpegPath(ffmpegPath); // Corrected method name to setFfmpegPath
    console.log(`FFmpeg path set to: ${ffmpegPath}`);
  } else {
    console.error(`FFmpeg not found at ${ffmpegPath}. Please ensure FFmpeg is installed.`);
  }
} catch (err) {
  console.error(`Error setting FFmpeg path: ${err.message}`);
}

const app = express();
const upload = multer({ dest: 'uploads/' });
const PORT = process.env.PORT || 3000;
const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

app.use(cors({
  origin: ['https://synthcalm.com', 'https://synthcalm.github.io']
}));

app.use(express.json());

// Transcription route
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
    console.error(`Transcription error: ${err.message}`);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  } finally {
    fs.unlink(req.file.path, () => {});
    fs.unlink(convertedPath, () => {});
  }
});

// Chat route with Roy's new persona and voice style
app.post('/api/chat', async (req, res) => {
  const { message, persona } = req.body;
  let responseText = '';
  let responseAudio = '';

  try {
    if (persona === 'roy') {
      // Roy's new therapeutic, casual responses with linguistic markers
      if (message.toLowerCase().includes('testing') || message.toLowerCase().includes('check')) {
        responseText = "Hey, so… like… I hear you testing things out, yeah? (0.3s pause) Sounds like you’re making sure it all works — maybe feeling a bit unsure? (0.5s pause) What’s going on, man?";
      } else if (message.toLowerCase().includes('who are you') || message.toLowerCase().includes('purpose')) {
        responseText = "So… I’m Roy, you know? (0.3s pause) Kinda like your chill older brother, here to listen and help you figure stuff out. (0.5s pause) What’s on your mind, though?";
      } else if (message.toLowerCase().includes('therapist') || message.toLowerCase().includes('what happened')) {
        responseText = "Yeah… I’m here to support you, man, like a friend who listens, you know? (0.3s pause) Sounds like you’re wondering about my role — maybe something feels off? (0.5s pause) Wanna talk about that a bit more?";
      } else if (message.toLowerCase().includes('stuck')) {
        responseText = "Ohh, yeah… I hear that. (0.3s pause) It’s like… you’re standing at this giant wall, and it’s not clear if there’s even a door in it, right? (0.5s pause) Umm… where do you think that stuckness is coming from? No rush — we can just sit with it.";
      } else {
        responseText = "Ahh, yeah… I hear you saying, '" + message + ".' (0.3s pause) That makes me wonder how you’re feeling right now, you know? (0.5s pause) Wanna unpack that a bit more? Totally okay if not.";
      }

      const ttsRes = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1',
          input: responseText,
          voice: 'onyx',
          speed: 0.9,
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );
      responseAudio = Buffer.from(ttsRes.data).toString('base64');
    } else if (persona === 'randy') {
      responseText = `Randy: I hear you saying, "${message}". Tell me more—let it all out!`;
      const ttsRes = await axios.post(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1',
          input: responseText,
          voice: 'echo',
        },
        {
          headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          responseType: 'arraybuffer',
        }
      );
      responseAudio = Buffer.from(ttsRes.data).toString('base64');
    }

    res.json({
      text: responseText,
      audio: responseAudio,
    });
  } catch (err) {
    console.error(`Chat route error: ${err.message}`);
    res.status(500).json({ error: 'Failed to generate audio response' });
  }
});

app.get('/', (req, res) => {
  res.send('Roy Chatbot Backend Running');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
