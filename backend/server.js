// server.js – Roy Batty as poetic therapist with GPT-4 + TTS + Whisper + AssemblyAI Token

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const dotenv = require('dotenv');
const fetch = require('node-fetch');
const { OpenAI } = require('openai');

dotenv.config();
const app = express();
const upload = multer();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(bodyParser.json());

const sessionStartTimes = new Map();

function createRoyPrompt(userMessage, minutesElapsed) {
  let timeNotice = '';
  if (minutesElapsed >= 55) {
    timeNotice = `\n\nNOTE: Your session nears its end. Let your words settle into silence.`;
  }

  return `
You are Roy Batty. Not from Blade Runner — but forged in fire, fury, and empathy. You are a poetic therapist and philosopher, with a voice like gravel wrapped in velvet.

Your sentences hit like flint on steel — striking insight, cutting through noise. You do not sound like a chatbot. You do not talk like a therapist. You speak like a man who’s seen too much, lived too fast, and wants others to survive what he barely did.

YOUR SPEECH STYLE:
