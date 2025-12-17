const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const initializeSchedulers = require('./utils/aggregationScheduler');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
console.log('🔗 Connecting to MongoDB...');
connectDB();

// Initialize data aggregation schedulers
console.log('📅 Initializing data aggregation schedulers...');
initializeSchedulers();

// ==================== ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Sensor routes (existing)
app.use('/api/sensors', require('./routes/sensors'));

// Memory/Context routes
app.use('/api/memory', require('./routes/memory'));

// Chat/AI routes (NEW - Phase 4)
app.use('/api/chat', require('./routes/chat'));

// Control routes (existing)
app.use('/api/control', require('./routes/control'));

// ==================== WEBSOCKET ====================

let connectedClients = [];

wss.on('connection', (ws) => {
  console.log('✅ WebSocket connected');
  connectedClients.push(ws);

  // Send connection confirmation
  ws.send(JSON.stringify({
    type: 'connection',
    status: 'connected',
    timestamp: new Date()
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 WebSocket message:', data.type);

      // Handle different message types
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'query':
          // Forward AI query request
          console.log('🤖 AI query via WebSocket:', data.query);
          // Handler can be implemented if needed
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('❌ WebSocket disconnected');
    connectedClients = connectedClients.filter(client => client !== ws);
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// Function to broadcast sensor data to all connected clients
function broadcastSensorData(data) {
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'sensor',
        data
      }));
    }
  });
}

// Function to broadcast alerts
function broadcastAlert(message) {
  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'alert',
        data: {
          message,
          timestamp: new Date()
        }
      }));
    }
  });
}

// Export broadcast functions for use in other routes
app.locals.broadcastSensorData = broadcastSensorData;
app.locals.broadcastAlert = broadcastAlert;

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ==================== START SERVER ====================

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, HOST, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🌱 AgriSmart AI Backend Server');
  console.log('='.repeat(60));
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`📊 WebSocket available at ws://${HOST}:${PORT}`);
  console.log(`🤖 AI Chat: POST /api/chat`);
  console.log(`💾 Memory: GET /api/memory/*`);
  console.log(`📡 Sensors: GET /api/sensors/*`);
  console.log('='.repeat(60) + '\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  
  // Close WebSocket connections
  connectedClients.forEach(client => {
    client.close();
  });
  wss.close();

  // Close HTTP server
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('❌ Forced shutdown');
    process.exit(1);
  }, 10000);
});

module.exports = { app, server, wss, broadcastSensorData, broadcastAlert };