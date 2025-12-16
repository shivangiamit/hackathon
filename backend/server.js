const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { WebSocketServer } = require('ws');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
require('dotenv').config();

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

// ================= STATE MANAGEMENT =================
const SensorManager = {
  current: {
    temperature: 0,
    humidity: 0,
    moisture: 0,
    motorStatus: false,
    crop: 'Tomato',
    manualMode: false,
    timestamp: new Date()
  },
  history: [],
  
  update(data) {
    this.current = { ...this.current, ...data, timestamp: new Date() };
    this.history.push(this.current);
    if (this.history.length > 100) this.history.shift();
  },

  getAnalytics() {
    if (this.history.length === 0) return { avgTemp: 0, avgHum: 0, avgMoist: 0 };
    const avg = (key) => (this.history.reduce((sum, d) => sum + d[key], 0) / this.history.length).toFixed(1);
    return {
      avgTemp: avg('temperature'),
      avgHum: avg('humidity'),
      avgMoist: avg('moisture'),
      count: this.history.length
    };
  }
};

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

mqttClient.on('message', (topic, message) => {
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
      }
    }
    
    // Handle plain text crop changes
    if (topic === 'agrismart/crop') {
      const cropName = typeof data === 'string' ? data : data.crop;
      SensorManager.current.crop = cropName;
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
server.listen(PORT, () => {
  console.log(`\n🌱 AgriSmart Backend Server`);
  console.log(`📡 HTTP Server: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`🔗 MQTT: ${mqttClient.connected ? 'Connected' : 'Connecting...'}`);
  console.log(`🤖 Google AI: ${process.env.GOOGLE_AI_KEY ? 'Ready' : 'Not configured'}\n`);
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