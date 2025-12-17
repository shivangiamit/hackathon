const express = require('express');
const router = express.Router();
const memoryService = require('../services/memoryService');

/**
 * GET /api/memory/conversations
 * Get recent conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const userId = req.query.userId || 'farmer_001';
    const days = parseInt(req.query.days) || 7;
    const limit = parseInt(req.query.limit) || 10;
    
    const conversations = await memoryService.getRecentConversations(userId, days, limit);
    
    res.json({
      success: true,
      count: conversations.length,
      data: conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/memory/trends
 * Get sensor trends
 */
router.get('/trends', async (req, res) => {
  try {
    const userId = req.query.userId || 'farmer_001';
    const days = parseInt(req.query.days) || 7;
    
    const trends = await memoryService.getRecentTrends(userId, days);
    
    if (!trends) {
      return res.json({
        success: false,
        message: 'Not enough data to calculate trends'
      });
    }
    
    res.json({
      success: true,
      days,
      data: trends
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/memory/profile
 * Get farmer profile
 */
router.get('/profile', async (req, res) => {
  try {
    const userId = req.query.userId || 'farmer_001';
    
    const profile = await memoryService.getFarmerProfile(userId);
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/memory/irrigation-history
 * Get irrigation patterns
 */
router.get('/irrigation-history', async (req, res) => {
  try {
    const userId = req.query.userId || 'farmer_001';
    const days = parseInt(req.query.days) || 7;
    
    const history = await memoryService.getIrrigationHistory(userId, days);
    
    res.json({
      success: true,
      days,
      data: history
    });
  } catch (error) {
    console.error('Error fetching irrigation history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/memory/anomalies
 * Detect anomalies in current sensor data
 */
router.post('/anomalies', async (req, res) => {
  try {
    const userId = req.body.userId || 'farmer_001';
    const currentSensors = req.body.sensors;
    
    if (!currentSensors) {
      return res.status(400).json({
        success: false,
        error: 'Current sensor data is required'
      });
    }
    
    const anomalies = await memoryService.detectAnomalies(userId, currentSensors);
    
    res.json({
      success: true,
      count: anomalies.length,
      data: anomalies
    });
  } catch (error) {
    console.error('Error detecting anomalies:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/memory/context
 * Get full enriched context (for testing)
 */
router.post('/context', async (req, res) => {
  try {
    const userId = req.body.userId || 'farmer_001';
    const query = req.body.query || 'Test query';
    const currentSensors = req.body.sensors;
    const queryType = req.body.queryType || 'general';
    
    if (!currentSensors) {
      return res.status(400).json({
        success: false,
        error: 'Current sensor data is required'
      });
    }
    
    const context = await memoryService.buildEnrichedContext(
      userId,
      query,
      currentSensors,
      queryType
    );
    
    // Also return formatted version
    const formattedContext = memoryService.formatContextForAI(context);
    
    res.json({
      success: true,
      enrichedContext: context,
      formattedForAI: formattedContext,
      stats: context.contextStats
    });
  } catch (error) {
    console.error('Error building context:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/memory/feedback
 * Update conversation outcome
 */
router.post('/feedback', async (req, res) => {
  try {
    const { conversationId, actionTaken, wasSuccessful } = req.body;
    
    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'conversationId is required'
      });
    }
    
    const conversation = await memoryService.updateConversationOutcome(
      conversationId,
      actionTaken,
      wasSuccessful
    );
    
    res.json({
      success: true,
      message: 'Feedback recorded',
      data: conversation
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/memory/successful-actions
 * Get successful past actions
 */
router.get('/successful-actions', async (req, res) => {
  try {
    const userId = req.query.userId || 'farmer_001';
    const limit = parseInt(req.query.limit) || 5;
    
    const actions = await memoryService.getSuccessfulActions(userId, limit);
    
    res.json({
      success: true,
      count: actions.length,
      data: actions
    });
  } catch (error) {
    console.error('Error fetching successful actions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/memory/daily-summaries
 * Get daily summaries
 */
router.get('/daily-summaries', async (req, res) => {
  try {
    const userId = req.query.userId || 'farmer_001';
    const days = parseInt(req.query.days) || 30;
    
    const summaries = await memoryService.getDailySummaries(userId, days);
    
    res.json({
      success: true,
      count: summaries.length,
      data: summaries
    });
  } catch (error) {
    console.error('Error fetching daily summaries:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;