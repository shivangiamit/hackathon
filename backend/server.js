const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const WebSocket = require('ws');
const http = require('http');
const mqtt = require('mqtt');

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Database
const connectDB = require('./config/db');
connectDB();

// Initialize scheduler
const initializeSchedulers = require('./utils/aggregationScheduler');
initializeSchedulers();

// Models
const { SensorHistory } = require('./models/SensorHistory');

// Routes
const sensorRoutes = require('./routes/sensor');
const chatRoutes = require('./routes/chat');
const memoryRoutes = require('./routes/memory');
const voiceRoutes = require('./routes/voice');

// API Routes
app.use('/api/sensor', sensorRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/memory', memoryRoutes);
app.use('/api/voice', voiceRoutes);

// ==================== MQTT SETUP ====================

const mqttBroker = process.env.MQTT_BROKER || 'mqtt://broker.hivemq.com:1883';
let mqttClient;

const initMQTT = () => {
  mqttClient = mqtt.connect(mqttBroker);

  mqttClient.on('connect', () => {
    console.log('🔗 MQTT Connected to broker');
    
    // Subscribe to sensor data topic
    mqttClient.subscribe('agrismart/sensors', (err) => {
      if (!err) {
        console.log('📡 Subscribed to: agrismart/sensors');
      }
    });
    
    mqttClient.subscribe('agrismart/motor/status', (err) => {
      if (!err) {
        console.log('📡 Subscribed to: agrismart/motor/status');
      }
    });
    
    mqttClient.subscribe('agrismart/status', (err) => {
      if (!err) {
        console.log('📡 Subscribed to: agrismart/status');
      }
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      
      console.log(`\n📨 MQTT Message received on topic: ${topic}`);
      console.log('Payload:', JSON.stringify(data, null, 2));

      if (topic === 'agrismart/sensors') {
        // Save sensor data to database
        const sensorEntry = await SensorHistory.create({
          userId: 'farmer_001',
          moisture: data.moisture || 0,
          ph: data.ph || 6.5,
          nitrogen: data.nitrogen || 150,
          phosphorus: data.phosphorus || 50,
          potassium: data.potassium || 180,
          temperature: data.temperature || 0,
          humidity: data.humidity || 0,
          cropType: data.crop || 'Tomato',
          motorStatus: data.motorStatus || false,
          manualMode: data.manualMode || false
        });

        console.log('✅ Sensor data saved to database');

        // Broadcast to WebSocket clients
        if (app.locals.broadcastSensorData) {
          app.locals.broadcastSensorData({
            userId: 'farmer_001',
            moisture: data.moisture,
            temperature: data.temperature,
            humidity: data.humidity,
            ph: data.ph,
            nitrogen: data.nitrogen,
            phosphorus: data.phosphorus,
            potassium: data.potassium,
            crop: data.crop,
            motorStatus: data.motorStatus,
            manualMode: data.manualMode,
            timestamp: new Date()
          });
          console.log('📡 Broadcast to WebSocket clients');
        }
      }

    } catch (error) {
      console.error('❌ Error processing MQTT message:', error.message);
    }
  });

  mqttClient.on('error', (error) => {
    console.error('❌ MQTT Error:', error);
  });

  mqttClient.on('disconnect', () => {
    console.log('⚠️ MQTT Disconnected');
  });
};

// Initialize MQTT connection
initMQTT();

// ==================== ADDITIONAL SENSOR ENDPOINTS ====================

app.get('/api/sensor/latest', async (req, res) => {
  try {
    const userId = req.query.userId || 'farmer_001';
    const latest = await SensorHistory.getLatestReading(userId);
    res.json({ success: true, data: latest || {} });
  } catch (error) {
    console.error('Error fetching latest sensor:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/sensor/recent', async (req, res) => {
  try {
    const userId = req.query.userId || 'farmer_001';
    const hours = parseInt(req.query.hours) || 24;
    const data = await SensorHistory.getRecentData(userId, hours);
    res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Error fetching recent sensor data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== WEBSOCKET SETUP ====================

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🔗 WebSocket client connected');

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log('📨 WebSocket message:', message.type);

      // Handle different message types
      if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('❌ WebSocket client disconnected');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Broadcast sensor data to all connected clients
app.locals.broadcastSensorData = (sensorData) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'sensor',
        data: sensorData
      }));
    }
  });
};

// ==================== HEALTH CHECK ====================

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime()
  });
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: err.message,
    message: 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path
  });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 AgriSmart Backend Server');
  console.log('='.repeat(60));
  console.log(`📡 HTTP Server: http://localhost:${PORT}`);
  console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
  console.log(`💾 Database: Connected`);
  console.log(`🔌 MQTT: Connected`);
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⏹️  Shutting down...');
  wss.clients.forEach((client) => {
    client.close();
  });
  if (mqttClient) {
    mqttClient.end();
  }
  await mongoose.connection.close();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});