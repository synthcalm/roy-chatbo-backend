// === NEW AssemblyAI Token Route ===
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;

app.use(cors({ origin: ['https://synthcalm.com', 'https://synthcalm.github.io'] }));
app.use(express.json());

// NEW Secure Route for Token
app.post('/api/get-assembly-token', async (req, res) => {
  try {
    const response = await axios.post('https://api.assemblyai.com/v2/realtime/token', {}, {
      headers: { 'Authorization': ASSEMBLY_API_KEY }
    });
    res.json({ token: response.data.token });
  } catch (error) {
    console.error('AssemblyAI token error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to get AssemblyAI token' });
  }
});

// === Your existing /api/chat route remains here ===

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
