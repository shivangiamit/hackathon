const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    default: 'farmer_001', // Single user for now
    index: true
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  // User Query
  query: {
    type: String,
    required: true
  },
  
  queryType: {
    type: String,
    enum: ['watering', 'disease', 'fertilizer', 'pest', 'weather', 'general', 'ph', 'nutrients'],
    default: 'general'
  },
  
  queryComplexity: {
    type: String,
    enum: ['simple', 'complex'],
    default: 'simple'
  },
  
  // Context at time of query
  sensorSnapshot: {
    moisture: Number,
    ph: Number,
    nitrogen: Number,
    phosphorus: Number,
    potassium: Number,
    temperature: Number,
    humidity: Number
  },
  
  cropType: {
    type: String,
    default: 'Tomato'
  },
  
  // Context used for response
  contextUsed: {
    pastConversationsCount: { type: Number, default: 0 },
    sensorTrendDays: { type: Number, default: 0 },
    similarQueriesFound: { type: Number, default: 0 }
  },
  
  // LangGraph processing details
  langgraphState: {
    classificationResult: mongoose.Schema.Types.Mixed,
    subQueries: [String],
    judgeScore: Number,
    retriesNeeded: { type: Number, default: 0 },
    processingTimeMs: Number
  },
  
  // AI Response
  aiResponse: {
    type: String,
    required: true
  },
  
  confidence: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  reasoning: [String], // Step-by-step reasoning
  
  recommendations: [{
    action: String,
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'] },
    cost: String,
    timeline: String,
    details: String
  }],
  
  // Outcome tracking (updated later by user)
  actionTaken: {
    type: String,
    enum: ['followed', 'ignored', 'modified', 'pending', null],
    default: null
  },
  
  actionTimestamp: Date,
  
  wasSuccessful: {
    type: Boolean,
    default: null
  },
  
  farmerFeedback: {
    type: String,
    enum: ['👍', '👎', null],
    default: null
  },
  
  feedbackComment: String,
  
  // Related conversations
  relatedConversations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation'
  }],
  
  tags: [String]
});

// Indexes for fast queries
ConversationSchema.index({ userId: 1, timestamp: -1 });
ConversationSchema.index({ userId: 1, queryType: 1 });
ConversationSchema.index({ userId: 1, cropType: 1 });
ConversationSchema.index({ timestamp: -1 });

// TTL Index - AUTO DELETE after 30 days (crop cycle duration)
ConversationSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

// Methods
ConversationSchema.methods.markActionTaken = function(action, success) {
  this.actionTaken = action;
  this.actionTimestamp = new Date();
  this.wasSuccessful = success;
  return this.save();
};

ConversationSchema.methods.addFeedback = function(feedback, comment) {
  this.farmerFeedback = feedback;
  if (comment) this.feedbackComment = comment;
  return this.save();
};

// Static methods
ConversationSchema.statics.getRecentConversations = function(userId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.find({
    userId,
    timestamp: { $gte: startDate }
  }).sort({ timestamp: -1 }).limit(50);
};

ConversationSchema.statics.findSimilarQueries = function(userId, queryType, limit = 5) {
  return this.find({
    userId,
    queryType,
    wasSuccessful: true // Only get successful past solutions
  }).sort({ timestamp: -1 }).limit(limit);
};

ConversationSchema.statics.getSuccessfulActions = function(userId) {
  return this.find({
    userId,
    wasSuccessful: true,
    actionTaken: { $ne: null }
  }).select('actionTaken recommendations timestamp cropType').sort({ timestamp: -1 });
};

module.exports = mongoose.model('Conversation', ConversationSchema);