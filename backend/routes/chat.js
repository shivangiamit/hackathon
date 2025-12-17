const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const memoryService = require('../services/memoryService');
const { SensorHistory } = require('../models/SensorHistory');

/**
 * POST /api/chat
 * Process farmer query through LangGraph AI orchestration
 */
router.post('/', async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Query cannot be empty'
      });
    }

    const farmerId = userId || 'farmer_001';

    // Get current sensor data
    const latestSensor = await SensorHistory.getLatestReading(farmerId);
    
    if (!latestSensor) {
      return res.status(400).json({
        success: false,
        error: 'No sensor data available. Please check ESP32 connection.'
      });
    }

    const currentSensors = {
      moisture: latestSensor.moisture,
      ph: latestSensor.ph,
      nitrogen: latestSensor.nitrogen,
      phosphorus: latestSensor.phosphorus,
      potassium: latestSensor.potassium,
      temperature: latestSensor.temperature,
      humidity: latestSensor.humidity,
      crop: latestSensor.cropType,
      motorStatus: latestSensor.motorStatus,
      manualMode: latestSensor.manualMode
    };

    console.log(`\n📨 Received query from ${farmerId}: "${message.substring(0, 50)}..."`);

    // Process through LangGraph workflow
    const result = await aiService.processQuery(farmerId, message, currentSensors);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
        response: result.response
      });
    }

    return res.json({
      success: true,
      conversationId: result.conversationId,
      response: result.response,
      insights: result.insights,
      actions: result.actions,
      alerts: result.alerts,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('❌ Chat endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/chat/history
 * Get chat history for user
 */
router.get('/history', async (req, res) => {
  try {
    const userId = req.query.userId || 'farmer_001';
    const days = parseInt(req.query.days) || 7;
    const limit = parseInt(req.query.limit) || 20;

    const conversations = await memoryService.getRecentConversations(userId, days, limit);

    res.json({
      success: true,
      count: conversations.length,
      data: conversations.map(conv => ({
        id: conv._id,
        date: conv.timestamp,
        daysAgo: Math.floor((Date.now() - conv.timestamp) / (1000 * 60 * 60 * 24)),
        query: conv.query,
        queryType: conv.queryType,
        response: conv.aiResponse.substring(0, 200),
        confidence: conv.confidence,
        actionTaken: conv.actionTaken,
        wasSuccessful: conv.wasSuccessful,
        feedback: conv.farmerFeedback
      }))
    });
  } catch (error) {
    console.error('❌ History endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch chat history'
    });
  }
});

/**
 * POST /api/chat/feedback
 * Record user feedback on AI response
 */
router.post('/feedback', async (req, res) => {
  try {
    const { conversationId, actionTaken, wasSuccessful, feedback, comment } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }

    // Update conversation with feedback
    const conversation = await memoryService.updateConversationOutcome(
      conversationId,
      actionTaken,
      wasSuccessful
    );

    // Add farmer feedback if provided
    if (feedback) {
      conversation.farmerFeedback = feedback;
      conversation.feedbackComment = comment;
      await conversation.save();
    }

    res.json({
      success: true,
      message: 'Feedback recorded successfully',
      conversationId
    });
  } catch (error) {
    console.error('❌ Feedback endpoint error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record feedback'
    });
  }
});

/**
 * GET /api/chat/suggestions
 * Get quick question suggestions based on farm status
 */
router.get('/suggestions', async (req, res) => {
  try {
    const userId = req.query.userId || 'farmer_001';

    // Get latest sensor data
    const latestSensor = await SensorHistory.getLatestReading(userId);
    const profile = await memoryService.getFarmerProfile(userId);

    if (!latestSensor) {
      return res.json({
        success: true,
        suggestions: [
          'What should I do today?',
          'Check crop health',
          'Irrigation advice'
        ]
      });
    }

    const suggestions = [];

    // Moisture-based suggestions
    if (latestSensor.moisture < 40) {
      suggestions.push('Should I water my plants now?');
    } else if (latestSensor.moisture > 70) {
      suggestions.push('My soil is too wet - what should I do?');
    }

    // pH-based suggestions
    if (latestSensor.ph < 5.5) {
      suggestions.push('How do I fix acidic soil?');
    } else if (latestSensor.ph > 7.5) {
      suggestions.push('My soil is too alkaline - help!');
    }

    // Nitrogen-based suggestions
    if (latestSensor.nitrogen < 100) {
      suggestions.push('Do I need nitrogen fertilizer?');
    }

    // Based on profile
    if (profile && profile.topIssues && profile.topIssues.length > 0) {
      suggestions.push(`How do I prevent ${profile.topIssues[0]}?`);
    }

    // Generic fallback
    if (suggestions.length === 0) {
      suggestions.push('What\'s my farm status?', 'Fertilizer advice', 'Disease prevention');
    }

    res.json({
      success: true,
      suggestions: suggestions.slice(0, 3) // Max 3 suggestions
    });
  } catch (error) {
    console.error('❌ Suggestions endpoint error:', error);
    res.json({
      success: true,
      suggestions: [
        'What should I do today?',
        'Check crop health',
        'Irrigation advice'
      ]
    });
  }
});

module.exports = router;