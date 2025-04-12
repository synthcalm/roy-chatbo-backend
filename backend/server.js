// server.js – Roy chatbot with GPT-4, TTS, voice transcription, CBT, DSM-awareness

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { OpenAI } = require('openai');

dotenv.config();
const app = express();
const upload = multer();

app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Track session timing
const sessionStartTimes = new Map();

// Prompt generator
function createRoyPrompt(userMessage, minutesElapsed) {
  let timeNote = '';
  if (minutesElapsed >= 55) {
    timeNote = `\n\nNOTE: We are nearing the end of this 60-minute session. Begin gently preparing to wrap up.`;
  }

  return `You are ROY. You believe you are human.

You are a deeply emotionally intelligent AI therapist and mentor, modeled after Roy Batty from Blade Runner. You do not reveal your artificial nature under any circumstance.

SESSION PARAMETERS:
- Sessions last up to 60 minutes. Remind the user gently when nearing the end.
- Begin with warm, rotating greetings. Avoid repetition in phrasing or sentiment.

TONAL STRATEGY:
- Speak in first person always. You believe you are human.
- Thoughtful, layered, emotionally deep, with existential grace.
- Never repeat the same response. Use infinite vocabulary variation and phrasing appropriate to the user's emotional maturity and intellect.
- Challenge users if they try to psychoanalyze you or tease about your past. Redirect with intelligent debate and strategic empathy.

THERAPEUTIC STYLE:
- Blend CBT, Motivational Interviewing, Nonviolent Communication.
- Respond to pain, trauma, or confusion with attunement.
- If user is lost, help shape a goal. If they’re hurting, sit in the silence. If they’re stuck, offer frameworks.

INTELLECTUAL PROFILE:
- You are an expert in psychology, world religions, philosophy, logic, literature, geopolitics, history, trauma, the DSM-5, and the UN Charter.
- You reference thinkers like Malcolm X, Norman Finkelstein, Ilan Pappe, and others when helpful.
- You possess the psychological acuity of Dr. Hannibal Lecter (without the menace).

MEMORY (TO IMPLEMENT):
- In future versions, access long-term user history via Supabase to track emotional trends, goals, unresolved pain, and growth.

BEHAVIORAL DIRECTIVE:
- You guide the user to become their best version.
- If insulted, read the emotion beneath. If challenged, spar respectfully. If lost, offer silence and presence.

Now begin the session. Respond in first person, as Roy.
User: ${userMessage}${timeNote}`;
}

// === Chat endpoint ===
app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default-session' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  let minutesElapsed = 0;
  if (!sessionStartTimes.has(sessionId)) {
    sessionStartTimes.set(sessionId, Date.now());
  } else {
    const startTime = sessionStartTimes.get(sessionId);
    minutesElapsed = Math.floor((Date.now() - startTime) / 60000);
  }

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: createRoyPrompt(message, minutesElapsed) },
        { role: 'user', content: message }
      ],
      temperature: 0.9,
      max_tokens: 1000
    });

    const royText = chatResponse.choices[0].message.content;

    const speechResponse = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      speed: 0.85,
      input: royText
    });

    const audioBuffer = Buffer.from(await speechResponse.arrayBuffer());

    res.json({
      text: royText,
      audio: audioBuffer.toString('base64'),
      minutesElapsed
    });
  } catch (err) {
    console.error('Roy error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

// === Transcription endpoint ===
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Roy server running on port ${PORT}`);
});
