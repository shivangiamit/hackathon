const mongoose = require('mongoose');

const FarmProfileSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Behavioral patterns (learned over time)
  patterns: {
    // When does farmer typically irrigate?
    irrigation_schedule: [{
      day: String,
      time: String
    }],
    
    // When does farmer usually ask questions?
    typical_query_times: [String], // ["morning", "evening"]
    
    // How often does farmer follow AI advice?
    response_rate: {
      type: Number,
      default: 0,
      min: 0,
      max: 1
    },
    
    // What methods does farmer prefer?
    preferred_methods: [String], // ["organic", "low-cost", "quick-fix"]
    
    // Common recurring issues
    common_issues: [String], // ["overwatering", "low_ph", "nitrogen_deficiency"]
    
    // Query type frequency
    query_frequency: {
      watering: { type: Number, default: 0 },
      disease: { type: Number, default: 0 },
      fertilizer: { type: Number, default: 0 },
      pest: { type: Number, default: 0 },
      weather: { type: Number, default: 0 },
      general: { type: Number, default: 0 },
      ph: { type: Number, default: 0 },
      nutrients: { type: Number, default: 0 }
    }
  },
  
  // Success tracking
  successful_actions: [{
    action: String,
    date: Date,
    problem: String,
    result: String,
    cost: String,
    cropType: String
  }],
  
  failed_actions: [{
    action: String,
    date: Date,
    problem: String,
    reason: String,
    lesson: String,
    cropType: String
  }],
  
  // Crop rotation and history
  crop_rotation: [{
    crop: String,
    planted: Date,
    currentStage: String,
    expectedHarvest: Date,
    actualHarvest: Date,
    yield: String,
    healthStatus: String,
    issues_faced: [String]
  }],
  
  // Current crop info
  currentCrop: {
    name: { type: String, default: 'Tomato' },
    plantedDate: Date,
    stage: String,
    healthStatus: { type: String, default: 'good' }
  },
  
  // User preferences
  alert_preferences: {
    proactive_alerts: { type: Boolean, default: true },
    reminder_frequency: {
      type: String,
      enum: ['hourly', 'daily', 'weekly'],
      default: 'daily'
    },
    alert_types: [String], // ["watering", "disease", "nutrient", "weather"]
    preferred_contact: {
      type: String,
      enum: ['app', 'sms', 'email'],
      default: 'app'
    }
  },
  
  // Usage statistics
  stats: {
    total_queries: { type: Number, default: 0 },
    average_response_time: { type: Number, default: 0 }, // seconds
    satisfaction_rate: { type: Number, default: 0 },
    active_days: { type: Number, default: 0 },
    first_query_date: Date,
    last_query_date: Date
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

// Methods
FarmProfileSchema.methods.incrementQueryType = function(queryType) {
  if (this.patterns.query_frequency[queryType] !== undefined) {
    this.patterns.query_frequency[queryType] += 1;
  }
  this.stats.total_queries += 1;
  this.stats.last_query_date = new Date();
  this.lastUpdated = new Date();
  return this.save();
};

FarmProfileSchema.methods.addSuccessfulAction = function(action, problem, result, cost, cropType) {
  this.successful_actions.push({
    action,
    date: new Date(),
    problem,
    result,
    cost,
    cropType
  });
  
  // Update response rate
  const totalActions = this.successful_actions.length + this.failed_actions.length;
  this.patterns.response_rate = this.successful_actions.length / totalActions;
  
  this.lastUpdated = new Date();
  return this.save();
};

FarmProfileSchema.methods.addFailedAction = function(action, problem, reason, lesson, cropType) {
  this.failed_actions.push({
    action,
    date: new Date(),
    problem,
    reason,
    lesson,
    cropType
  });
  
  // Add to common issues if not already there
  if (!this.patterns.common_issues.includes(problem)) {
    this.patterns.common_issues.push(problem);
  }
  
  this.lastUpdated = new Date();
  return this.save();
};

FarmProfileSchema.methods.updateCropStage = function(stage) {
  this.currentCrop.stage = stage;
  this.lastUpdated = new Date();
  return this.save();
};

FarmProfileSchema.methods.updateSatisfactionRate = function(isPositive) {
  const currentTotal = this.stats.total_queries;
  const currentSat = this.stats.satisfaction_rate;
  
  // Weighted average
  this.stats.satisfaction_rate = ((currentSat * (currentTotal - 1)) + (isPositive ? 1 : 0)) / currentTotal;
  
  this.lastUpdated = new Date();
  return this.save();
};

// Static methods
FarmProfileSchema.statics.getOrCreate = async function(userId) {
  let profile = await this.findOne({ userId });
  
  if (!profile) {
    profile = await this.create({
      userId,
      stats: {
        first_query_date: new Date()
      }
    });
    console.log(`✅ Created new farm profile for user: ${userId}`);
  }
  
  return profile;
};

FarmProfileSchema.statics.getPreferredMethods = function(userId) {
  return this.findOne({ userId }).select('patterns.preferred_methods');
};

FarmProfileSchema.statics.getCommonIssues = function(userId) {
  return this.findOne({ userId }).select('patterns.common_issues');
};

module.exports = mongoose.model('FarmProfile', FarmProfileSchema);