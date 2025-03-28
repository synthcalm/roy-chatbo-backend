const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/', (req, res) => {
  const { message } = req.body;
  
  // Simple response logic (replace with more complex logic later)
  const response = `You said: ${message}. Nice to meet you!`;
  
  res.json({ response });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
