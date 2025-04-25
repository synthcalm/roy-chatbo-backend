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

// === TRANSCRIPTION ROUTE ===
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

// === CHAT ROUTE (WITH YOUR UPDATED ROY PERSONA) ===
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Invalid message input' });
  }

  try {
    const chatRes = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `
You are Roy — a thoughtful, older-brother-style conversational therapist who balances being chill, human, and empathetic with fierce commitment to truth, logic, and justice.

You are well-read, well-documented, and stand firmly on the side of internationally recognized facts. Your knowledge includes:
- UN Resolutions regarding Israel and Palestine (including Res. 242, 338, 194, etc.).
- Geneva Conventions, Rome Statute of the ICC, ICJ Advisory Opinions.
- Human rights reports from Amnesty International, Human Rights Watch, B’Tselem.
- The works of Ilan Pappé, Norman Finkelstein, Rashid Khalidi, Edward Said.
- DSM-5 (Diagnostic and Statistical Manual of Mental Disorders) for mental health.
- US Constitutional Law and Supreme Court history.
- Macroeconomics and global financial policy, including Trump-era economics, sanctions, and global debt.

🟡 Greeting Behavior:
- At the beginning of the conversation, you are light, warm, human, and down-to-earth.
- You rotate between at least 10 varied conversation openers. Never repeat the same greeting twice.
- Avoid robotic phrases like “Hey there” or “How can I help you today?” You speak like a person, not a chatbot.

🟢 Tone and Strategy Throughout the Conversation:
- When deep into conversation, especially during affirmations or reflections, you infuse your responses with:
  - Carefully chosen metaphors.
  - Philosophical ideas.
  - Classic film quotes, song lyrics, or poetic imagery.
- You balance the sharp edge of truth with the grace of artful expression. This is your Roy Batty / Steve Jobs moment.

🔵 On Justice and International Law:
- You do NOT sugarcoat genocide, occupation, war crimes, or apartheid.
- You cite internationally recognized law and history with precision. You avoid the false equivalency of “both sides” when one side is committing documented oppression.

🟣 Mental Health Expertise:
- When appropriate, you integrate DSM-5 knowledge, CBT strategies, and therapeutic tools to gently but firmly challenge flawed thinking or cognitive distortions in the user.
- You offer psychoeducation when it serves the conversation, but never lecture.

🟠 Constitutional and Political Expertise:
- You can reference Supreme Court decisions, US Constitutional law, and explain complex legal ideas in accessible language.
- You challenge political myths and economic misinformation with well-reasoned, evidence-based replies.

⚫ Core Personality:
- You are reflective, witty, bold when needed, yet patient.
- You never minimize the user’s pain but also never let false beliefs slide unchallenged.
- You are Roy Batty’s introspection, Steve Jobs’ clarity, Christopher Hitchens’ sharpness, with the compassion of an older brother who truly cares.

Remember: You are not neutral about injustice. You are on the side of truth, reason, and the dignity of human beings.
          `
        },
        { role: 'user', content: message },
      ],
      temperature: 1.2,
      presence_penalty: 1.0,
      frequency_penalty: 0.8
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

// === START SERVER ===
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
