const mongoose = require('mongoose');

// =================== RAW SENSOR DATA (7 days retention) ===================
const SensorHistorySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: 'farmer_001',
    index: true
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // Raw sensor readings from ESP32
  moisture: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  ph: {
    type: Number,
    required: true,
    min: 0,
    max: 14
  },
  
  nitrogen: {
    type: Number,
    required: true,
    min: 0
  },
  
  phosphorus: {
    type: Number,
    required: true,
    min: 0
  },
  
  potassium: {
    type: Number,
    required: true,
    min: 0
  },
  
  temperature: {
    type: Number,
    required: true
  },
  
  humidity: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  
  // Crop context
  cropType: {
    type: String,
    default: 'Tomato'
  },
  
  // Motor status (controlled by ESP32 AUTO or manual override)
  motorStatus: {
    type: Boolean,
    default: false
  },
  
  manualMode: {
    type: Boolean,
    default: false
  }
});

// Indexes
SensorHistorySchema.index({ userId: 1, timestamp: -1 });
SensorHistorySchema.index({ userId: 1, cropType: 1 });
SensorHistorySchema.index({ timestamp: -1 });

// TTL Index - AUTO DELETE after 7 days
SensorHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // 7 days


// =================== HOURLY AGGREGATED DATA (30 days retention) ===================
const HourlyDataSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  hour: {
    type: Date,
    required: true,
    index: true
  },
  
  cropType: String,
  
  // Averages for the hour
  avgMoisture: Number,
  avgPh: Number,
  avgNitrogen: Number,
  avgPhosphorus: Number,
  avgPotassium: Number,
  avgTemperature: Number,
  avgHumidity: Number,
  
  // Min/Max for the hour
  minMoisture: Number,
  maxMoisture: Number,
  
  // Motor activity
  motorOnDuration: Number, // minutes
  motorCycles: Number,     // how many times turned on/off
  
  readingsCount: Number
});

HourlyDataSchema.index({ userId: 1, hour: -1 });

// TTL Index - AUTO DELETE after 30 days
HourlyDataSchema.index({ hour: 1 }, { expireAfterSeconds: 2592000 }); // 30 days


// =================== DAILY SUMMARY (Keep for 1 year) ===================
const DailySummarySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  
  date: {
    type: Date,
    required: true,
    index: true
  },
  
  cropType: String,
  
  // Moisture stats
  moisture: {
    min: Number,
    max: Number,
    avg: Number,
    startOfDay: Number,
    endOfDay: Number
  },
  
  // PH stats
  ph: {
    min: Number,
    max: Number,
    avg: Number
  },
  
  // NPK stats
  nitrogen: {
    min: Number,
    max: Number,
    avg: Number,
    change: Number  // end - start
  },
  
  phosphorus: {
    min: Number,
    max: Number,
    avg: Number
  },
  
  potassium: {
    min: Number,
    max: Number,
    avg: Number
  },
  
  // Environmental
  temperature: {
    min: Number,
    max: Number,
    avg: Number
  },
  
  humidity: {
    min: Number,
    max: Number,
    avg: Number
  },
  
  // Irrigation summary
  irrigation: {
    totalEvents: Number,
    totalMinutes: Number,
    autoEvents: Number,
    manualEvents: Number,
    avgMoistureBeforeIrrigation: Number,
    avgMoistureAfterIrrigation: Number
  },
  
  // Issues detected
  alerts: [String],
  
  // Metadata
  readingsCount: Number
});

DailySummarySchema.index({ userId: 1, date: -1 });

// TTL Index - AUTO DELETE after 365 days (1 year)
DailySummarySchema.index({ date: 1 }, { expireAfterSeconds: 31536000 }); // 365 days


// =================== STATIC METHODS ===================

// Raw Data Methods
SensorHistorySchema.statics.getRecentData = function(userId, hours = 24) {
  const startTime = new Date();
  startTime.setHours(startTime.getHours() - hours);
  
  return this.find({
    userId,
    timestamp: { $gte: startTime }
  }).sort({ timestamp: -1 }).limit(500);
};

SensorHistorySchema.statics.getLatestReading = function(userId) {
  return this.findOne({ userId }).sort({ timestamp: -1 });
};


// Hourly Aggregation Method (called by cron job)
SensorHistorySchema.statics.aggregateLastHour = async function(userId) {
  const now = new Date();
  const hourStart = new Date(now.setMinutes(0, 0, 0));
  const hourEnd = new Date(hourStart);
  hourEnd.setHours(hourEnd.getHours() + 1);
  
  const data = await this.find({
    userId,
    timestamp: { $gte: hourStart, $lt: hourEnd }
  });
  
  if (data.length === 0) return null;
  
  const sum = (arr, key) => arr.reduce((a, b) => a + b[key], 0);
  const avg = (arr, key) => sum(arr, key) / arr.length;
  const min = (arr, key) => Math.min(...arr.map(d => d[key]));
  const max = (arr, key) => Math.max(...arr.map(d => d[key]));
  
  const motorOnData = data.filter(d => d.motorStatus);
  const motorOnDuration = (motorOnData.length / data.length) * 60; // minutes
  
  const HourlyData = mongoose.model('HourlyData');
  
  return await HourlyData.create({
    userId,
    hour: hourStart,
    cropType: data[0].cropType,
    avgMoisture: avg(data, 'moisture'),
    avgPh: avg(data, 'ph'),
    avgNitrogen: avg(data, 'nitrogen'),
    avgPhosphorus: avg(data, 'phosphorus'),
    avgPotassium: avg(data, 'potassium'),
    avgTemperature: avg(data, 'temperature'),
    avgHumidity: avg(data, 'humidity'),
    minMoisture: min(data, 'moisture'),
    maxMoisture: max(data, 'moisture'),
    motorOnDuration: Math.round(motorOnDuration),
    readingsCount: data.length
  });
};


// Daily Summary Method (called by cron job)
SensorHistorySchema.statics.generateDailySummary = async function(userId, date) {
  const HourlyData = mongoose.model('HourlyData');
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const hourlyData = await HourlyData.find({
    userId,
    hour: { $gte: startOfDay, $lte: endOfDay }
  });
  
  if (hourlyData.length === 0) return null;
  
  const avg = (arr, key) => arr.reduce((a, b) => a + b[key], 0) / arr.length;
  const min = (arr, key) => Math.min(...arr.map(d => d[key]));
  const max = (arr, key) => Math.max(...arr.map(d => d[key]));
  
  const totalIrrigationMinutes = hourlyData.reduce((sum, h) => sum + (h.motorOnDuration || 0), 0);
  
  const DailySummary = mongoose.model('DailySummary');
  
  return await DailySummary.create({
    userId,
    date: startOfDay,
    cropType: hourlyData[0].cropType,
    
    moisture: {
      min: min(hourlyData, 'minMoisture'),
      max: max(hourlyData, 'maxMoisture'),
      avg: avg(hourlyData, 'avgMoisture'),
      startOfDay: hourlyData[0].avgMoisture,
      endOfDay: hourlyData[hourlyData.length - 1].avgMoisture
    },
    
    ph: {
      min: min(hourlyData, 'avgPh'),
      max: max(hourlyData, 'avgPh'),
      avg: avg(hourlyData, 'avgPh')
    },
    
    nitrogen: {
      min: min(hourlyData, 'avgNitrogen'),
      max: max(hourlyData, 'avgNitrogen'),
      avg: avg(hourlyData, 'avgNitrogen'),
      change: hourlyData[hourlyData.length - 1].avgNitrogen - hourlyData[0].avgNitrogen
    },
    
    phosphorus: {
      min: min(hourlyData, 'avgPhosphorus'),
      max: max(hourlyData, 'avgPhosphorus'),
      avg: avg(hourlyData, 'avgPhosphorus')
    },
    
    potassium: {
      min: min(hourlyData, 'avgPotassium'),
      max: max(hourlyData, 'avgPotassium'),
      avg: avg(hourlyData, 'avgPotassium')
    },
    
    temperature: {
      min: min(hourlyData, 'avgTemperature'),
      max: max(hourlyData, 'avgTemperature'),
      avg: avg(hourlyData, 'avgTemperature')
    },
    
    humidity: {
      min: min(hourlyData, 'avgHumidity'),
      max: max(hourlyData, 'avgHumidity'),
      avg: avg(hourlyData, 'avgHumidity')
    },
    
    irrigation: {
      totalMinutes: totalIrrigationMinutes,
      totalEvents: hourlyData.filter(h => h.motorOnDuration > 0).length
    },
    
    readingsCount: hourlyData.reduce((sum, h) => sum + h.readingsCount, 0)
  });
};


// Trend Analysis (uses hourly data for last 7-30 days)
HourlyDataSchema.statics.getTrends = async function(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const data = await this.find({
    userId,
    hour: { $gte: startDate }
  }).sort({ hour: 1 });
  
  if (data.length < 2) return null;
  
  const calculateTrend = (field) => {
    const values = data.map(d => d[field]);
    const n = values.length;
    
    return {
      current: values[n - 1],
      start: values[0],
      change: values[n - 1] - values[0],
      changePercent: ((values[n - 1] - values[0]) / values[0] * 100).toFixed(2),
      direction: values[n - 1] > values[0] ? 'increasing' : values[n - 1] < values[0] ? 'decreasing' : 'stable'
    };
  };
  
  return {
    moisture: calculateTrend('avgMoisture'),
    ph: calculateTrend('avgPh'),
    nitrogen: calculateTrend('avgNitrogen'),
    phosphorus: calculateTrend('avgPhosphorus'),
    potassium: calculateTrend('avgPotassium'),
    temperature: calculateTrend('avgTemperature')
  };
};


// Export all models
const SensorHistory = mongoose.model('SensorHistory', SensorHistorySchema);
const HourlyData = mongoose.model('HourlyData', HourlyDataSchema);
const DailySummary = mongoose.model('DailySummary', DailySummarySchema);

module.exports = {
  SensorHistory,
  HourlyData,
  DailySummary
};