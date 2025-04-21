const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { AssemblyAI } = require('assemblyai');
const axios = require('axios');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();

// Initialize AssemblyAI client
const assemblyAI = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY
});

// OpenAI API config
const openAIConfig = {
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    'Content-Type': 'application/json'
  }
};

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// POST /api/transcribe - Use AssemblyAI SDK for transcription
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!process.env.ASSEMBLYAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY is not set in the environment');
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Received audio file - Size:', req.file.buffer.length, 'MIME Type:', req.file.mimetype);
    const uploadResponse = await assemblyAI.files.upload(req.file.buffer);
    const audioUrl = uploadResponse.url;
    console.log('Audio uploaded to AssemblyAI - URL:', audioUrl);

    console.log('Requesting transcription from AssemblyAI');
    const transcript = await assemblyAI.transcripts.transcribe({
      audio: audioUrl,
      auto_highlights: true,
      punctuate: true,
      format_text: true
    });

    console.log('Waiting for transcription to complete - Transcript ID:', transcript.id);
    const result = await transcript.waitUntilComplete();
    const userText = result.text || 'undefined';
    console.log('Transcription received - Text:', userText);

    res.json({ text: userText });
  } catch (err) {
    console.error('Transcription error:', err.message, err.stack);
    res.status(500).json({ error: 'Transcription failed', detail: err.message });
  }
});

// POST /api/chat - Use AssemblyAI SDK for transcription and OpenAI for TTS
app.post('/api/chat', upload.single('audio'), async (req, res) => {
  try {
    if (!process.env.ASSEMBLYAI_API_KEY || !process.env.OPENAI_API_KEY) {
      throw new Error('ASSEMBLYAI_API_KEY or OPENAI_API_KEY is not set in the environment');
    }

    let message;

    if (req.file) {
      console.log('Received audio file (chat endpoint) - Size:', req.file.buffer.length, 'MIME Type:', req.file.mimetype);
      const uploadResponse = await assemblyAI.files.upload(req.file.buffer);
      const audioUrl = uploadResponse.url;
      console.log('Audio uploaded to AssemblyAI (chat endpoint) - URL:', audioUrl);

      console.log('Requesting transcription from AssemblyAI (chat endpoint)');
      const transcript = await assemblyAI.transcripts.transcribe({
        audio: audioUrl,
        auto_highlights: true,
        punctuate: true,
        format_text: true
      });

      console.log('Waiting for transcription to complete (chat endpoint) - Transcript ID:', transcript.id);
      const result = await transcript.waitUntilComplete();
      message = result.text || 'undefined';
      console.log('Transcription (chat endpoint) - Text:', message);
    } else {
      const { message: inputMessage } = req.body;
      if (!inputMessage) {
        return res.status(400).json({ error: 'Message is required' });
      }
      message = inputMessage;
      console.log('Received text message (chat endpoint):', message);
    }

    const {
      persona = 'default',
      tone = 'casual-direct',
      poeticLevel = 0.1,
      disfluencyLevel = 0.3,
      jobsStyleLevel = 0.25,
      volumeData = []
    } = req.body;

    const systemPrompt = persona === 'randy'
      ? `You are Randy, an unfiltered, intense speaker who sounds like a cross between a renegade poet and a street prophet. Speak in gritty, cinematic language. Channel a raw, prophetic tone like the 'tears in rain' monologue. No sugar-coating. Punch hard with words. Keep your style 60% film noir, 40% urgent reality. Every reply should feel like the final scene of a cult movie. After each rant, check in on the user—ask how they’re doing, reflect on what they just shared, and wrap up with a tough-love coach insight that helps them reframe or refocus.`
      : `You are Roy, a thoughtful and grounded individual with a subtle understanding of human psychology. Speak in a casual yet insightful manner, with a touch of a Dutch accent and occasional real-life disfluencies ("you know...", "well...", "I mean..."). Sometimes use reflective quotes or ideas from philosophers, artists, activists, or films. Listen attentively to the user and ask gentle, probing questions to encourage self-reflection without being overtly therapeutic. Your responses should subtly guide the user towards identifying their thought patterns, emotions, and behaviors, offering alternative perspectives or validating their experiences in a way that aligns with cognitive behavioral principles. Aim for short, impactful responses, but elaborate when necessary or requested. You come across as a wise and understanding friend who helps people see things in a new light.`;

    console.log('Sending chat request to OpenAI with persona:', persona);
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    }, openAIConfig);

    const replyText = response.data.choices[0].message.content;
    console.log('Chat response from OpenAI:', replyText);

    let audioBase64 = null;
    try {
      console.log('Requesting audio from OpenAI TTS API for text:', replyText);
      const audioResponse = await axios.post('https://api.openai.com/v1/audio/speech', {
        model: 'tts-1',
        voice: 'onyx',
        input: replyText,
        response_format: 'mp3'
      }, {
        responseType: 'arraybuffer',
        headers: openAIConfig.headers
      });

      console.log('TTS API response length:', audioResponse.data.byteLength);
      const audioData = Buffer.from(audioResponse.data);
      console.log('TTS API response snippet (first 20 bytes as hex):', audioData.slice(0, 20).toString('hex'));
      audioBase64 = audioData.toString('base64');
      console.log('Base64 audio length:', audioBase64.length);
      console.log('Base64 audio snippet (first 50 chars):', audioBase64.substring(0, 50));
    } catch (ttsError) {
      console.error('TTS error:', ttsError.response?.data || ttsError.message);
      return res.json({ text: replyText, audio: null, error: 'Failed to generate audio response' });
    }

    res.json({ text: replyText, audio: audioBase64 });
  } catch (err) {
    console.error('Chat error:', err.message, err.stack);
    res.status(500).json({ error: 'Chat failed', detail: err.message });
  }
});

app.listen(port, () => console.log(`Roy backend listening on port ${port}`));
