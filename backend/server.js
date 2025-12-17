const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { WebSocketServer } = require('ws');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
require('dotenv').config();

// MongoDB connection
const connectDB = require('./config/db');
const initializeSchedulers = require('./utils/aggregationScheduler');

// Models
const Conversation = require('./models/Conversation');
const { SensorHistory, HourlyData, DailySummary } = require('./models/SensorHistory');
const FarmProfile = require('./models/FarmProfile');

// ================= CONFIGURATION =================
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 5000;

// Initialize Google AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate Limiters
const limits = {
  api: rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }),
  ai:  rateLimit({ windowMs: 60 * 1000, max: 10, message: { error: "AI cooling down..." } })
};

// ================= CROP PROFILES WITH PH & NPK =================
const cropProfiles = {
  'Tomato': { 
    ph: { min: 6.0, max: 6.8, optimal: 6.5 },
    npk: { n: { min: 150, max: 200 }, p: { min: 40, max: 60 }, k: { min: 180, max: 240 } }
  },
  'Rice': { 
    ph: { min: 5.5, max: 6.5, optimal: 6.0 },
    npk: { n: { min: 100, max: 150 }, p: { min: 30, max: 50 }, k: { min: 100, max: 150 } }
  },
  'Wheat': { 
    ph: { min: 6.0, max: 7.0, optimal: 6.5 },
    npk: { n: { min: 120, max: 180 }, p: { min: 40, max: 70 }, k: { min: 80, max: 120 } }
  },
  'Potato': { 
    ph: { min: 5.0, max: 6.0, optimal: 5.5 },
    npk: { n: { min: 100, max: 150 }, p: { min: 50, max: 80 }, k: { min: 200, max: 280 } }
  },
  'Chilli': { 
    ph: { min: 6.0, max: 7.0, optimal: 6.5 },
    npk: { n: { min: 130, max: 180 }, p: { min: 50, max: 80 }, k: { min: 150, max: 200 } }
  },
  'Sugarcane': { 
    ph: { min: 6.0, max: 7.5, optimal: 6.5 },
    npk: { n: { min: 200, max: 300 }, p: { min: 60, max: 100 }, k: { min: 150, max: 250 } }
  },
  'Cotton': { 
    ph: { min: 5.5, max: 6.5, optimal: 6.0 },
    npk: { n: { min: 100, max: 160 }, p: { min: 40, max: 70 }, k: { min: 80, max: 140 } }
  },
  'Lettuce': { 
    ph: { min: 6.0, max: 7.0, optimal: 6.5 },
    npk: { n: { min: 150, max: 220 }, p: { min: 50, max: 80 }, k: { min: 180, max: 250 } }
  }
};

// ================= STATE MANAGEMENT =================
const SensorManager = {
  current: {
    temperature: 0,
    humidity: 0,
    moisture: 0,
    ph: 6.5,
    nitrogen: 150,
    phosphorus: 50,
    potassium: 180,
    motorStatus: false,
    crop: 'Tomato',
    manualMode: false,
    timestamp: new Date()
  },
  history: [],
  lastVariation: {
    ph: 0,
    nitrogen: 0,
    phosphorus: 0,
    potassium: 0
  },
  
  update(data) {
    this.current = { ...this.current, ...data, timestamp: new Date() };
    // Add mock PH & NPK data
    this.addMockSoilData();
    this.history.push(this.current);
    if (this.history.length > 100) this.history.shift();
  },

  addMockSoilData() {
    const crop = this.current.crop;
    const profile = cropProfiles[crop] || cropProfiles['Tomato'];
    
    // Generate realistic PH with slow variation
    const phVariation = (Math.random() - 0.5) * 0.1; // ±0.05
    this.lastVariation.ph += phVariation;
    this.lastVariation.ph = Math.max(-0.3, Math.min(0.3, this.lastVariation.ph)); // Keep within ±0.3
    this.current.ph = parseFloat((profile.ph.optimal + this.lastVariation.ph).toFixed(2));
    this.current.ph = Math.max(profile.ph.min, Math.min(profile.ph.max, this.current.ph));
    
    // Generate realistic NPK with slow variation
    const generateNutrient = (nutrient, key) => {
      const variation = (Math.random() - 0.5) * 10; // ±5
      this.lastVariation[key] += variation;
      this.lastVariation[key] = Math.max(-20, Math.min(20, this.lastVariation[key])); // Keep within ±20
      const optimal = (nutrient.min + nutrient.max) / 2;
      let value = optimal + this.lastVariation[key];
      value = Math.max(nutrient.min, Math.min(nutrient.max, value));
      return Math.round(value);
    };
    
    this.current.nitrogen = generateNutrient(profile.npk.n, 'nitrogen');
    this.current.phosphorus = generateNutrient(profile.npk.p, 'phosphorus');
    this.current.potassium = generateNutrient(profile.npk.k, 'potassium');
  },

  getAnalytics() {
    if (this.history.length === 0) return { 
      avgTemp: 0, avgHum: 0, avgMoist: 0, 
      avgPh: 0, avgN: 0, avgP: 0, avgK: 0 
    };
    const avg = (key) => (this.history.reduce((sum, d) => sum + d[key], 0) / this.history.length).toFixed(1);
    return {
      avgTemp: avg('temperature'),
      avgHum: avg('humidity'),
      avgMoist: avg('moisture'),
      avgPh: avg('ph'),
      avgN: avg('nitrogen'),
      avgP: avg('phosphorus'),
      avgK: avg('potassium'),
      count: this.history.length
    };
  }
};

// Initialize mock soil data on startup
SensorManager.addMockSoilData();

// ================= WEBSOCKET SERVICE =================
let wsClients = [];

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');
  wsClients.push(ws);
  
  // Send current data immediately
  ws.send(JSON.stringify({
    type: 'current',
    data: SensorManager.current
  }));
  
  ws.on('close', () => {
    console.log('❌ WebSocket client disconnected');
    wsClients = wsClients.filter(client => client !== ws);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast to all WebSocket clients
function broadcast(type, data) {
  const message = JSON.stringify({ type, data });
  wsClients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      try {
        client.send(message);
      } catch (err) {
        console.error('WebSocket send error:', err);
      }
    }
  });
}

// ================= MQTT SERVICE =================
const mqttClient = mqtt.connect('mqtt://broker.hivemq.com:1883', {
  clientId: `agrismart_backend_${Date.now()}`,
  reconnectPeriod: 1000
});

mqttClient.on('connect', () => {
  console.log('✅ MQTT Connected');
  mqttClient.subscribe('agrismart/#');
});

mqttClient.on('message', async (topic, message) => {
  try {
    const msgStr = message.toString();
    let data;
    
    // Try parsing as JSON, if fails treat as plain text
    try {
      data = JSON.parse(msgStr);
    } catch {
      data = msgStr; // Plain text like "Rice", "ON", "OFF"
    }
    
    if (topic === 'agrismart/sensors' || topic === 'agrismart/data') {
      if (typeof data === 'object') {
        SensorManager.update(data);
        console.log('📊 Sensor update:', data);
        broadcast('sensor', SensorManager.current);
        
        // Store in MongoDB for historical analysis
        try {
          await SensorHistory.create({
            userId: 'farmer_001',
            moisture: SensorManager.current.moisture,
            ph: SensorManager.current.ph,
            nitrogen: SensorManager.current.nitrogen,
            phosphorus: SensorManager.current.phosphorus,
            potassium: SensorManager.current.potassium,
            temperature: SensorManager.current.temperature,
            humidity: SensorManager.current.humidity,
            cropType: SensorManager.current.crop,
            motorStatus: SensorManager.current.motorStatus
          });
        } catch (err) {
          console.error('Error storing sensor history:', err.message);
        }
      }
    }
    
    // Handle plain text crop changes
    if (topic === 'agrismart/crop') {
      const cropName = typeof data === 'string' ? data : data.crop;
      SensorManager.current.crop = cropName;
      // Reset variations when crop changes for realistic transition
      SensorManager.lastVariation = { ph: 0, nitrogen: 0, phosphorus: 0, potassium: 0 };
      SensorManager.addMockSoilData();
      console.log('🌱 Crop changed to:', cropName);
      broadcast('sensor', SensorManager.current);
    }
    
    if (topic === 'agrismart/motor' || topic === 'agrismart/motor/status') {
      const status = typeof data === 'object' ? data.motor : (data === 'ON');
      SensorManager.current.motorStatus = status;
      broadcast('motor', { status });
    }
    
    if (topic === 'agrismart/alert') {
      console.log('⚠️ Alert:', data);
      broadcast('alert', { message: typeof data === 'string' ? data : data.message });
    }
    
  } catch (err) {
    console.error('MQTT Error:', err.message);
  }
});

mqttClient.on('error', (err) => {
  console.error('❌ MQTT Error:', err);
});

// ================= AI SERVICES =================

const handleChat = async (message) => {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash-lite",
    systemInstruction: "You are an expert agricultural consultant. Keep answers concise (max 3 sentences) and practical."
  });

  const prompt = `
    Context:
    - Crop: ${SensorManager.current.crop}
    - Soil Moisture: ${SensorManager.current.moisture}%
    - Temp: ${SensorManager.current.temperature}°C
    - PH: ${SensorManager.current.ph}
    - NPK (N-P-K): ${SensorManager.current.nitrogen}-${SensorManager.current.phosphorus}-${SensorManager.current.potassium} ppm
    - Motor is: ${SensorManager.current.motorStatus ? 'ON' : 'OFF'}
    
    User Question: ${message}
  `;

  const result = await model.generateContent(prompt);
  return result.response.text();
};

// 2. Disease Detection Service (Using Typed Schema)
const handleImageAnalysis = async (base64) => {
  const clean = base64.replace(/^data:image\/\w+;base64,/, "");

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    generationConfig: {
      responseMimeType: "application/json",
    }
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: clean,
              mimeType: "image/jpeg"
            }
          },
          {
            text: `
              Analyze the leaf and return JSON ONLY with:
              - name
              - confidence (0-100)
              - severity
              - description
              - causes[]
              - treatment[]
              - prevention
            `
          }
        ]
      }
    ]
  });

  return JSON.parse(result.response.text());
};


// ================= API ROUTES =================

app.use('/api/', limits.api);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mqtt: mqttClient.connected,
    websocket: wsClients.length,
    timestamp: new Date()
  });
});

// Sensor Routes
app.get('/api/sensors/current', (req, res) => res.json(SensorManager.current));

app.get('/api/sensors/history', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json(SensorManager.history.slice(-limit));
});

app.get('/api/analytics', (req, res) => res.json(SensorManager.getAnalytics()));

// Control Routes
app.post('/api/control', (req, res) => {
  const { type, value } = req.body; // type: 'motor' or 'crop' or 'manual'
  
  const topics = {
    motor: 'agrismart/motor',
    crop: 'agrismart/crop',
    manual: 'agrismart/manual/override'
  };

  if (!topics[type]) {
    return res.status(400).json({ error: "Invalid control type. Use: motor, crop, or manual" });
  }

  const payload = typeof value === 'string' ? value : JSON.stringify(value);
  
  mqttClient.publish(topics[type], payload, (err) => {
    if (err) {
      console.error('MQTT publish error:', err);
      return res.status(500).json({ success: false, error: 'Failed to publish command' });
    }
    
    console.log(`📤 Published to ${topics[type]}:`, payload);
    res.json({ success: true, type, value });
  });
});

// AI Routes
app.post('/api/chat', limits.ai, async (req, res) => {
  try {
    if (!req.body.message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const response = await handleChat(req.body.message);
    res.json({ response });
  } catch (error) {
    console.error("AI Chat Error:", error);
    res.status(500).json({ 
      response: "I'm having trouble connecting right now. Please try again." 
    });
  }
});

app.post('/api/disease-detection', limits.ai, async (req, res) => {
  try {
    if (!req.body.imageBase64) {
      return res.status(400).json({ error: 'Image data is required' });
    }
    
    const analysis = await handleImageAnalysis(req.body.imageBase64);
    res.json(analysis);
  } catch (error) {
    console.error("Vision Error:", error);
    res.status(500).json({ 
      name: "Analysis Failed", 
      confidence: 0,
      severity: "Unknown",
      description: "Could not analyze image",
      causes: [],
      treatment: ["Try a clearer, well-lit photo of the leaf"],
      prevention: ""
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ================= SERVER START =================
server.listen(PORT, async () => {
  // Connect to MongoDB
  await connectDB();
  
  // Initialize data aggregation schedulers
  initializeSchedulers();
  
  console.log(`\n🌱 AgriSmart Backend Server`);
  console.log(`📡 HTTP Server: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`🔗 MQTT: ${mqttClient.connected ? 'Connected' : 'Connecting...'}`);
  console.log(`🤖 Google AI: ${process.env.GOOGLE_AI_KEY ? 'Ready' : 'Not configured'}`);
  console.log(`🗄️  MongoDB: Connected\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    mqttClient.end();
    wss.close();
    process.exit(0);
  });
});