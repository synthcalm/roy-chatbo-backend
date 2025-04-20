const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');

const app = express();

// ✅ CORS MUST be first!
app.use(cors()); // Allows all origins temporarily

// ✅ Add manual headers for extra safety
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// ✅ Middleware must come after CORS
const upload = multer();
const cache = new NodeCache({ stdTTL: 600 });
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ✅ Optional: Load Roy's knowledge file if available
let royKnowledge = {};
try {
  const filePath = path.join(__dirname, '../roy-knowledge.json');
  royKnowledge = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log('✅ Loaded Roy Knowledge Base');
} catch (err) {
  console.error('❌ Failed to load Roy knowledge:', err);
}

// ✅ Analyze volume data for emotional context
function analyzeAudioForEmotion(audioBuffer, transcription) {
  const avgVolume = audioBuffer.reduce((sum, val) => sum + val, 0) / audioBuffer.length;
  const silenceThreshold = 10;
  const yellingThreshold = 80;
  const cryingKeywords = ['cry', 'crying', 'sad', 'tears'];
  const harmKeywords = ['hurt', 'kill', 'harm', 'attack'];

  if (avgVolume < silenceThreshold) return 'silence';
  if (avgVolume > yellingThreshold) {
    if (harmKeywords.some(keyword => transcription.toLowerCase().includes(keyword))) return 'harm';
    return 'yelling';
  }
  if (cryingKeywords.some(keyword => transcription.toLowerCase().includes(keyword))) return 'crying';
  return 'normal';
}

// ✅ Wisdom generation based on keywords
function generateWisdom(transcription) {
  const stressors = royKnowledge.life_stressors || [];
  const philosophers = royKnowledge.global_thinkers?.philosophy || [];
  let theme = 'general';

  for (const stressor of stressors) {
    if (transcription.toLowerCase().includes(stressor)) {
      theme = stressor;
      break;
    }
  }

  const wisdomQuotes = {
    abandonment: `Simone Weil once said, "Attention is the rarest and purest form of generosity." Perhaps it's time to give yourself that care.`,
    divorce: `Nietzsche reminds us, "That which does not kill us makes us stronger." This pain can be a forge for your resilience.`,
    unemployment: `Confucius taught, "Our greatest glory is not in never falling, but in rising every time we fall." A new path awaits.`,
    addiction: `Kierkegaard spoke of despair as the sickness unto death. Let’s find a step toward healing—small, but steady.`,
    war: `Muhammad said, "The best jihad is the one against your own ego." Peace begins within—let’s start there.`,
    bullying: `Malcolm X declared, "We need more light about each other." Understanding your worth can dim their words.`,
    illness: `Feynman found beauty in the universe’s mysteries. Your struggle is part of a larger story—let’s find its meaning.`,
    homelessness: `Mandela endured 27 years in captivity yet emerged with hope. You, too, can find a home in your spirit.`,
    general: `Sagan said, "We are made of starstuff." Your struggles are cosmic—let’s find the light in them.`
  };

  return wisdomQuotes[theme] || wisdomQuotes.general;
}

// ✅ Transcription Route
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: 'audio.webm',
      contentType: req.file.mimetype,
    });
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    res.json({ text: response.data.text });
  } catch (err) {
    console.error('Whisper error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Whisper transcription failed' });
  }
});

// ✅ Roy/Randy Chat Route
app.post('/api/chat', async (req, res) => {
  const { message, mode = 'both', persona = 'default', volumeData = [], context = royKnowledge } = req.body;

  const cacheKey = `${persona}:${message.slice(0, 50)}`;
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) return res.json(cachedResponse);

  try {
    let systemPrompt = `
You are Roy, a poetic, assertive, witty, and deeply reflective AI therapist influenced by Roy Batty, Steve Jobs, and Christopher Hitchens.
Use metaphors, cultural references, and poetic phrasing. Be challenging yet emotionally present.
`;

    let royText = '';
    let isInterimResponse = false;

    if (persona === 'randy') {
      systemPrompt = `
You are Randy, the bold, irreverent, validating version of Roy. You're here to let the user rant and feel empowered doing so.
Use fierce metaphors, fire-storm imagery, and bold encouragement.
`;
      const emotion = analyzeAudioForEmotion(volumeData, message);
      if (emotion === 'silence') {
        royText = 'I’m here—take your time, let it out when you’re ready.';
        isInterimResponse = true;
      } else if (emotion === 'crying') {
        royText = 'I hear your pain—like a storm breaking. Let’s weather it together.';
        isInterimResponse = true;
      } else if (emotion === 'harm') {
        royText = 'Whoa, let’s pause—this sounds heavy. Call someone you trust for help, okay?';
        isInterimResponse = true;
      }
    } else {
      systemPrompt += `
Tone: ${context.persona?.tone || 'assertive-poetic'}
Traits: ${context.persona?.traits?.join(', ') || 'empathetic, strategic, surprising'}
Therapy methods: ${context.therapy_methods?.join(', ') || 'CBT, Taoism, Zen'}
`;
    }

    if (!isInterimResponse) {
      if (persona === 'randy') {
        const wisdom = generateWisdom(message);
        royText = `That was a fiery rant—well done! Here's something to chew on: ${wisdom}`;
      } else {
        const chat = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ]
        });
        royText = chat.choices[0].message.content;
      }
    }

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

    const response = { text: royText, audio: audioBase64, persona };
    cache.set(cacheKey, response);
    res.json(response);
  } catch (err) {
    console.error('Chat error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

// ✅ Start server
app.listen(10000, () => console.log('✅ Roy server running on port 10000'));
