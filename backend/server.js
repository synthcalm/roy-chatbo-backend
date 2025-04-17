
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { OpenAI } = require('openai');

const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: req.file.buffer,
      model: 'whisper-1',
      response_format: 'json'
    });
    res.json({ text: transcription.text });
  } catch (err) {
    console.error('Whisper error:', err);
    res.status(500).json({ error: 'Whisper transcription failed' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message, mode = 'both' } = req.body;

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: "You're Roy, a calming AI therapist. Speak briefly and supportively." },
        { role: 'user', content: message }
      ]
    });

    const royText = chat.choices[0].message.content;
    let audioBase64 = null;

    if (mode === 'voice' || mode === 'both') {
      const audio = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input: royText
      });
      const buffer = Buffer.from(await audio.arrayBuffer());
      audioBase64 = buffer.toString('base64');
    }

    res.json({ text: royText, audio: audioBase64 });
  } catch (err) {
    console.error('Chat error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

app.listen(10000, () => console.log('✅ Roy server running on port 10000'));
