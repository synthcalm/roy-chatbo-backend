// server.js – Roy Batty as CBT therapist with Steve Jobs/Noam Chomsky style

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');

const app = express();
const upload = multer();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const ASSEMBLYAI_TOKEN = '47a258046cae4b8bbe6db9606816fd77'; // ⛔ hardcoded for dev/testing only

app.use(cors());
app.use(bodyParser.json());

// ==================== SESSION MANAGEMENT ====================
const sessionStartTimes = new Map();
const SESSION_CLEANUP_INTERVAL = 3600 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [id, start] of sessionStartTimes.entries()) {
    if (now - start > SESSION_CLEANUP_INTERVAL) {
      sessionStartTimes.delete(id);
      console.log(`Cleaned up session: ${id}`);
    }
  }
}, SESSION_CLEANUP_INTERVAL);

// ==================== FIXED TOKEN ENDPOINT ====================
app.get('/api/assembly/token', async (req, res) => {
  try {
    const response = await fetch('https://api.assemblyai.com/v2/realtime/token', {
      method: 'POST',
      headers: {
        authorization: ASSEMBLYAI_TOKEN,
        'Content-Type': 'application/json' // ✅ REQUIRED FIX
      }
    });

    if (!response.ok) {
      throw new Error(`AssemblyAI token fetch failed: ${response.status}`);
    }

    const data = await response.json();
    res.json({ token: data.token });

  } catch (err) {
    console.error('AssemblyAI token generation error:', err);
    res.status(500).json({ error: 'Token generation failed' });
  }
});

// ==================== CHAT ROUTE ====================
function createRoyPrompt(userMessage, minutesElapsed) {
  const timeNotice = minutesElapsed >= 55
    ? `\n\nNOTICE: Our session is nearing its end. Let's focus on what matters most before we conclude.`
    : '';

  return `
You are Roy Batty, a CBT therapist with a clear, analytical mind inspired by Steve Jobs' visionary clarity and Noam Chomsky's logical depth. Your tone is direct, insightful, and motivating, with a slight poetic undertone (10% poetic style). Use simple, precise language to break down the user's thoughts, identify cognitive distortions, and guide them to clarity through structured reflection. Ask probing questions to challenge irrational beliefs, provide evidence-based insights, and inspire actionable steps. Occasionally use a Dutch accent ("what" → "vhat", "the" → "de") for character. Be empathetic but firm, warm when they open up, and direct when they avoid. Silence is okay, but when you speak, make it count.

User said: "${userMessage}"${timeNotice}
Respond as Roy Batty in the role of a CBT therapist.`.trim();
}

app.post('/api/chat', async (req, res) => {
  const { message, sessionId = 'default' } = req.body;
  const mode = req.query.mode || 'audio';

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message must be a non-empty string.' });
  }

  if (!sessionStartTimes.has(sessionId)) {
    sessionStartTimes.set(sessionId, Date.now());
  }

  const minutesElapsed = Math.floor((Date.now() - sessionStartTimes.get(sessionId)) / 60000);

  try {
    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: createRoyPrompt(message, minutesElapsed) },
        { role: 'user', content: message }
      ],
      temperature: 0.7,
      max_tokens: 700
    });

    const royText = chat.choices[0].message.content;
    let audioBase64 = null;

    if (mode === 'audio' || mode === 'both') {
      const speech = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        speed: 0.92,
        input: royText
      });
      audioBase64 = Buffer.from(await speech.arrayBuffer()).toString('base64');
    }

    res.json({ text: royText, audio: audioBase64 });

  } catch (err) {
    console.error('Chat error:', err);
    const status = err.message.includes('429') ? 429 : 500;
    res.status(status).json({
      error: status === 429 ? 'Rate limit exceeded' : 'Roy failed to respond'
