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
const upload = multer();
const cache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes

app.use(cors({
  origin: ['https://synthcalm.github.io', 'https://synthcalm.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let royKnowledge = {};
try {
  const filePath = path.join(__dirname, '../roy-knowledge.json');
  royKnowledge = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log('✅ Loaded Roy Knowledge Base');
} catch (err) {
  console.error('❌ Failed to load Roy knowledge:', err);
}

// --- Rest of your original code stays unchanged ---
