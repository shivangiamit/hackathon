const express = require('express');
const router = express.Router();
const SensorHistory = require('../models/SensorHistory');

// Ingest a new sensor reading
router.post('/', async (req, res) => {
  const {
    userId = 'farmer_001',
    moisture, ph, nitrogen, phosphorus, potassium,
    temperature, humidity, cropType = 'Tomato',
    motorStatus = false, manualMode = false
  } = req.body;

  if ([moisture, ph, nitrogen, phosphorus, potassium, temperature, humidity].some(v => v === undefined)) {
    return res.status(400).json({ success: false, error: 'Missing required sensor fields' });
  }

  try {
    const entry = await SensorHistory.create({
      userId, moisture, ph, nitrogen, phosphorus, potassium,
      temperature, humidity, cropType, motorStatus, manualMode
    });

    if (req.app?.locals?.broadcastSensorData) {
      req.app.locals.broadcastSensorData(entry);
    }

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get latest reading
router.get('/latest', async (req, res) => {
  const userId = req.query.userId || 'farmer_001';
  try {
    const latest = await SensorHistory.getLatestReading(userId);
    res.json({ success: true, data: latest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get recent readings (query: ?hours=24)
router.get('/recent', async (req, res) => {
  const userId = req.query.userId || 'farmer_001';
  const hours = parseInt(req.query.hours, 10) || 24;
  try {
    const data = await SensorHistory.getRecentData(userId, hours);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;