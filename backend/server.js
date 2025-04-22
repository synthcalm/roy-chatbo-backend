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

// Simulated responses for Roy and Randy
const responses = {
  roy: {
    text: "I hear you, friend. Let’s dive deeper—what’s really on your mind?",
    audioBase64: "data:audio/mp3;base64,SUQzBAAAAAA...[placeholder]" // Placeholder Base64 audio
  },
  randy: {
    text: "Chaos detected! Let’s crank it up—what’s next?",
    audioBase64: "data:audio/mp3;base64,SUQzBAAAAAA...[placeholder]" // Placeholder Base64 audio
  }
};

// Transcribe audio using AssemblyAI
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
          authorization: ASSEMBLY_AI_KEY,
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
          headers: { authorization: ASSEMBLY_AI_KEY }
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

// Chat endpoint to handle bot responses
app.post('/api/chat', upload.single('audio'), async (req, res) => {
  try {
    let userText = '';
    let bot = req.body.bot || 'roy'; // Default to Roy if not specified

    if (req.file) {
      // If audio is provided, transcribe it first
      const convertedPath = path.join(__dirname, 'uploads', `${req.file.filename}-converted.wav`);
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
            'authorization': ASSEMBLY_AI_KEY,
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
            authorization: ASSEMBLY_AI_KEY,
            'content-type': 'application/json',
          }
        }
      );

      const transcriptId = transcriptRes.data.id;
      let completed = false;
      while (!completed) {
        const pollingRes = await axios.get(
          `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
          {
            headers: { authorization: ASSEMBLY_AI_KEY }
          }
        );

        if (pollingRes.data.status === 'completed') {
          completed = true;
          userText = pollingRes.data.text;
        } else if (pollingRes.data.status === 'error') {
          throw new Error('AssemblyAI transcription error');
        } else {
          await new Promise(r => setTimeout(r, 1500));
        }
      }

      fs.unlink(req.file.path, () => {});
      fs.unlink(convertedPath, () => {});
    } else if (req.body.message) {
      // If text is provided, use it directly
      userText = req.body.message;
      bot = req.body.persona || 'roy';
    } else {
      return res.status(400).json({ error: 'No audio or message provided' });
    }

    // Simulate bot response based on persona
    const botResponse = responses[bot] || responses.roy;
    res.json({
      text: botResponse.text,
      audio: botResponse.audioBase64
    });

  } catch (err) {
    console.error('[Chat Error]', err);
    res.status(500).json({ error: 'Failed to process chat request' });
  }
});

app.get('/', (req, res) => {
  res.send('Roy Chatbot Backend Running');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
