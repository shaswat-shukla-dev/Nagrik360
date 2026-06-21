const express = require('express');
const { chatAssistant } = require('../utils/groqClient');
const { fetchAQI } = require('../utils/aqi');

const router = express.Router();

// ---- Conversational civic assistant (Groq-powered) ----
router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const reply = await chatAssistant(messages);
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Live AQI lookup by coordinates ----
router.get('/aqi', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return res.status(400).json({ error: 'lat & lon required' });
    const data = await fetchAQI(lat, lon);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
