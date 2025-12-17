const Conversation = require('../models/Conversation');
const { SensorHistory, HourlyData, DailySummary } = require('../models/SensorHistory');
const FarmProfile = require('../models/FarmProfile');

/**
 * Memory Service - Fetches historical context for AI
 */
class MemoryService {
  
  /**
   * Get recent sensor trends (7 or 30 days)
   */
  async getRecentTrends(userId, days = 7) {
    try {
      const trends = await HourlyData.getTrends(userId, days);
      return trends;
    } catch (error) {
      console.error('Error fetching trends:', error);
      return null;
    }
  }

  /**
   * Get historical sensor averages
   */
  async getHistoricalAverages(userId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const result = await HourlyData.aggregate([
        {
          $match: {
            userId,
            hour: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: null,
            avgMoisture: { $avg: '$avgMoisture' },
            avgPh: { $avg: '$avgPh' },
            avgNitrogen: { $avg: '$avgNitrogen' },
            avgPhosphorus: { $avg: '$avgPhosphorus' },
            avgPotassium: { $avg: '$avgPotassium' },
            avgTemperature: { $avg: '$avgTemperature' },
            avgHumidity: { $avg: '$avgHumidity' }
          }
        }
      ]);
      
      return result[0] || null;
    } catch (error) {
      console.error('Error fetching averages:', error);
      return null;
    }
  }

  /**
   * Get recent conversations (last N days)
   */
  async getRecentConversations(userId, days = 7, limit = 10) {
    try {
      const conversations = await Conversation.getRecentConversations(userId, days);
      
      // Format for AI context
      return conversations.slice(0, limit).map(conv => ({
        date: conv.timestamp,
        daysAgo: Math.floor((Date.now() - conv.timestamp) / (1000 * 60 * 60 * 24)),
        query: conv.query,
        queryType: conv.queryType,
        aiResponse: conv.aiResponse.substring(0, 200), // Truncate for context
        userAction: conv.actionTaken,
        wasSuccessful: conv.wasSuccessful,
        feedback: conv.farmerFeedback,
        sensorAtTime: conv.sensorSnapshot
      }));
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return [];
    }
  }

  /**
   * Find similar past queries (same type)
   */
  async getSimilarQueries(userId, queryType, limit = 5) {
    try {
      const similar = await Conversation.findSimilarQueries(userId, queryType, limit);
      
      return similar.map(conv => ({
        date: conv.timestamp,
        daysAgo: Math.floor((Date.now() - conv.timestamp) / (1000 * 60 * 60 * 24)),
        query: conv.query,
        aiResponse: conv.aiResponse.substring(0, 150),
        wasSuccessful: conv.wasSuccessful,
        recommendations: conv.recommendations
      }));
    } catch (error) {
      console.error('Error finding similar queries:', error);
      return [];
    }
  }

  /**
   * Get successful past actions
   */
  async getSuccessfulActions(userId, limit = 5) {
    try {
      const actions = await Conversation.getSuccessfulActions(userId);
      
      return actions.slice(0, limit).map(conv => ({
        date: conv.timestamp,
        daysAgo: Math.floor((Date.now() - conv.timestamp) / (1000 * 60 * 60 * 24)),
        action: conv.actionTaken,
        recommendations: conv.recommendations,
        cropType: conv.cropType
      }));
    } catch (error) {
      console.error('Error fetching successful actions:', error);
      return [];
    }
  }

  /**
   * Get farmer behavioral profile
   */
  async getFarmerProfile(userId) {
    try {
      const profile = await FarmProfile.getOrCreate(userId);
      
      return {
        patterns: profile.patterns,
        currentCrop: profile.currentCrop,
        preferences: profile.alert_preferences,
        stats: profile.stats,
        topIssues: profile.patterns.common_issues.slice(0, 3),
        responseRate: profile.patterns.response_rate,
        preferredMethods: profile.patterns.preferred_methods
      };
    } catch (error) {
      console.error('Error fetching farmer profile:', error);
      return null;
    }
  }

  /**
   * Get irrigation history and patterns
   */
  async getIrrigationHistory(userId, days = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      // Get hourly data with motor information
      const hourlyData = await HourlyData.find({
        userId,
        hour: { $gte: startDate }
      }).sort({ hour: -1 });
      
      if (hourlyData.length === 0) {
        return {
          totalEvents: 0,
          totalMinutes: 0,
          avgDuration: 0,
          pattern: "No irrigation data available"
        };
      }
      
      const totalMinutes = hourlyData.reduce((sum, h) => sum + (h.motorOnDuration || 0), 0);
      const eventsWithIrrigation = hourlyData.filter(h => h.motorOnDuration > 0);
      
      // Detect irrigation pattern
      const irrigationHours = eventsWithIrrigation.map(h => h.hour.getHours());
      const commonHours = [...new Set(irrigationHours)].slice(0, 3);
      
      return {
        totalEvents: eventsWithIrrigation.length,
        totalMinutes,
        avgDuration: eventsWithIrrigation.length > 0 
          ? Math.round(totalMinutes / eventsWithIrrigation.length) 
          : 0,
        commonTimes: commonHours.map(h => `${h}:00`),
        pattern: commonHours.length > 0 
          ? `Usually irrigates around ${commonHours.join(', ')} hours`
          : "No clear pattern detected"
      };
    } catch (error) {
      console.error('Error fetching irrigation history:', error);
      return null;
    }
  }

  /**
   * Detect anomalies in sensor data
   */
  async detectAnomalies(userId, currentSensors) {
    try {
      const trends = await this.getRecentTrends(userId, 7);
      const averages = await this.getHistoricalAverages(userId, 7);
      
      if (!trends || !averages) return [];
      
      const anomalies = [];
      
      // Check moisture drop
      if (trends.moisture && Math.abs(trends.moisture.change) > 20) {
        anomalies.push({
          type: 'moisture_change',
          severity: 'high',
          message: `Moisture ${trends.moisture.direction} by ${Math.abs(trends.moisture.change)}% in 7 days`,
          current: currentSensors.moisture,
          trend: trends.moisture.direction
        });
      }
      
      // Check pH drift
      if (trends.ph && Math.abs(trends.ph.change) > 0.5) {
        anomalies.push({
          type: 'ph_change',
          severity: 'medium',
          message: `pH ${trends.ph.direction} by ${Math.abs(trends.ph.change)} in 7 days`,
          current: currentSensors.ph,
          trend: trends.ph.direction
        });
      }
      
      // Check nitrogen depletion
      if (trends.nitrogen && trends.nitrogen.change < -30) {
        anomalies.push({
          type: 'nitrogen_depletion',
          severity: 'high',
          message: `Nitrogen dropped by ${Math.abs(trends.nitrogen.change)} ppm in 7 days`,
          current: currentSensors.nitrogen,
          trend: 'decreasing'
        });
      }
      
      // Check temperature extremes
      if (currentSensors.temperature > 35 || currentSensors.temperature < 10) {
        anomalies.push({
          type: 'temperature_extreme',
          severity: currentSensors.temperature > 35 ? 'high' : 'medium',
          message: `Temperature ${currentSensors.temperature > 35 ? 'too high' : 'too low'}: ${currentSensors.temperature}°C`,
          current: currentSensors.temperature
        });
      }
      
      return anomalies;
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      return [];
    }
  }

  /**
   * Get daily summaries for long-term analysis
   */
  async getDailySummaries(userId, days = 30) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const summaries = await DailySummary.find({
        userId,
        date: { $gte: startDate }
      }).sort({ date: -1 }).limit(30);
      
      return summaries.map(s => ({
        date: s.date,
        moisture: s.moisture,
        ph: s.ph,
        irrigation: s.irrigation,
        alerts: s.alerts
      }));
    } catch (error) {
      console.error('Error fetching daily summaries:', error);
      return [];
    }
  }

  /**
   * BUILD ENRICHED CONTEXT - Main function that combines everything
   * NOW WITH SMART FILTERING based on query type
   */
  async buildEnrichedContext(userId, query, currentSensors, queryType = 'general') {
    try {
      console.log(`🧠 Building enriched context for: ${queryType}`);
      
      // Define what context is needed for each query type
      const contextNeeds = {
        watering: {
          trends: ['moisture', 'temperature', 'humidity'],
          trendDays: 7,
          conversations: 3,
          includeIrrigation: true,
          includeProfile: false,
          includeAnomalies: true
        },
        disease: {
          trends: ['temperature', 'humidity'],
          trendDays: 7,
          conversations: 2,
          includeIrrigation: false,
          includeProfile: false,
          includeAnomalies: true
        },
        fertilizer: {
          trends: ['nitrogen', 'phosphorus', 'potassium', 'ph'],
          trendDays: 14,
          conversations: 3,
          includeIrrigation: false,
          includeProfile: true,
          includeAnomalies: true
        },
        ph: {
          trends: ['ph', 'nitrogen'],
          trendDays: 14,
          conversations: 2,
          includeIrrigation: false,
          includeProfile: false,
          includeAnomalies: true
        },
        nutrients: {
          trends: ['nitrogen', 'phosphorus', 'potassium'],
          trendDays: 14,
          conversations: 3,
          includeIrrigation: false,
          includeProfile: true,
          includeAnomalies: true
        },
        general: {
          trends: ['moisture', 'ph'],
          trendDays: 7,
          conversations: 2,
          includeIrrigation: false,
          includeProfile: true,
          includeAnomalies: false
        }
      };
      
      const needs = contextNeeds[queryType] || contextNeeds.general;
      
      // Fetch only what's needed
      const contextPromises = [];
      
      // Always get short-term trends
      contextPromises.push(this.getRecentTrends(userId, needs.trendDays));
      
      // Always get recent conversations
      contextPromises.push(this.getRecentConversations(userId, needs.trendDays, needs.conversations));
      
      // Conditional fetches
      if (needs.includeProfile) {
        contextPromises.push(this.getFarmerProfile(userId));
      } else {
        contextPromises.push(Promise.resolve(null));
      }
      
      if (needs.includeIrrigation) {
        contextPromises.push(this.getIrrigationHistory(userId, 3)); // Last 3 days only
      } else {
        contextPromises.push(Promise.resolve(null));
      }
      
      if (needs.includeAnomalies) {
        contextPromises.push(this.detectAnomalies(userId, currentSensors));
      } else {
        contextPromises.push(Promise.resolve([]));
      }
      
      // Get similar queries (always useful)
      contextPromises.push(this.getSimilarQueries(userId, queryType, 2)); // Just 2
      
      const [
        trends,
        recentConversations,
        farmerProfile,
        irrigationHistory,
        anomalies,
        similarQueries
      ] = await Promise.all(contextPromises);
      
      // Filter trends to only include relevant parameters
      const filteredTrends = trends ? this._filterTrends(trends, needs.trends) : null;
      
      const enrichedContext = {
        // User query
        query,
        queryType,
        timestamp: new Date(),
        
        // Current state (always included)
        currentSensors,
        
        // Filtered historical trends (only relevant parameters)
        trends: filteredTrends,
        
        // Limited past conversations
        pastConversations: recentConversations.slice(0, needs.conversations),
        similarQueries,
        
        // Conditional context
        farmerProfile: needs.includeProfile ? farmerProfile : null,
        irrigationHistory: needs.includeIrrigation ? irrigationHistory : null,
        anomalies: needs.includeAnomalies ? anomalies : [],
        
        // Metadata
        contextStats: {
          conversationsFound: recentConversations.length,
          trendsIncluded: needs.trends,
          contextType: queryType,
          estimatedTokens: this._estimateTokens(recentConversations, filteredTrends, needs)
        }
      };
      
      console.log(`✅ Smart context built: ~${enrichedContext.contextStats.estimatedTokens} tokens`);
      
      return enrichedContext;
      
    } catch (error) {
      console.error('❌ Error building enriched context:', error);
      
      // Return minimal context on error
      return {
        query,
        queryType,
        currentSensors,
        trends: null,
        pastConversations: [],
        error: 'Limited context available'
      };
    }
  }
  
  /**
   * Filter trends to only include relevant parameters
   * @private
   */
  _filterTrends(trends, relevantParams) {
    if (!trends) return null;
    
    const filtered = {};
    relevantParams.forEach(param => {
      if (trends[param]) {
        filtered[param] = trends[param];
      }
    });
    
    return filtered;
  }
  
  /**
   * Estimate token count for context
   * @private
   */
  _estimateTokens(conversations, trends, needs) {
    let tokens = 100; // Base: query + sensors
    
    tokens += conversations.length * 100; // ~100 tokens per conversation
    
    if (trends) {
      tokens += needs.trends.length * 30; // ~30 tokens per trend
    }
    
    if (needs.includeProfile) tokens += 100;
    if (needs.includeIrrigation) tokens += 80;
    if (needs.includeAnomalies) tokens += 50;
    
    return tokens;
  }

  /**
   * Format context for AI prompt (human-readable)
   * NOW: Only includes relevant information based on what's present
   */
  formatContextForAI(enrichedContext) {
    const { currentSensors, trends, pastConversations, farmerProfile, irrigationHistory, anomalies, queryType } = enrichedContext;
    
    let contextText = `
=== QUERY TYPE: ${queryType.toUpperCase()} ===

=== CURRENT SENSOR DATA ===
Moisture: ${currentSensors.moisture}%
PH: ${currentSensors.ph}
Nitrogen: ${currentSensors.nitrogen} ppm
Phosphorus: ${currentSensors.phosphorus} ppm
Potassium: ${currentSensors.potassium} ppm
Temperature: ${currentSensors.temperature}°C
Humidity: ${currentSensors.humidity}%
Crop: ${currentSensors.crop}
Motor Status: ${currentSensors.motorStatus ? 'ON (irrigating)' : 'OFF'}
${currentSensors.manualMode ? '⚠️  MANUAL MODE: Auto-irrigation disabled by farmer' : '✓ AUTO MODE: ESP32 managing irrigation'}
`;

    // Add trends ONLY if available and relevant
    if (trends && Object.keys(trends).length > 0) {
      contextText += `\n=== RECENT TRENDS ===\n`;
      
      for (const [param, data] of Object.entries(trends)) {
        if (data && data.direction) {
          const arrow = data.direction === 'increasing' ? '↗️' : data.direction === 'decreasing' ? '↘️' : '→';
          contextText += `${param.toUpperCase()}: ${arrow} ${data.direction} (${data.change > 0 ? '+' : ''}${data.change} over period)\n`;
        }
      }
    }

    // Add anomalies ONLY if detected
    if (anomalies && anomalies.length > 0) {
      contextText += `\n=== ⚠️  DETECTED ISSUES ===\n`;
      anomalies.slice(0, 3).forEach(a => {  // Max 3 anomalies
        contextText += `${a.severity === 'high' ? '🔴' : '🟡'} ${a.message}\n`;
      });
    }

    // Add past conversations ONLY if relevant
    if (pastConversations && pastConversations.length > 0) {
      contextText += `\n=== RECENT HISTORY ===\n`;
      pastConversations.slice(0, 2).forEach(c => {  // Max 2 conversations
        const outcome = c.wasSuccessful === true ? '✅' : c.wasSuccessful === false ? '❌' : '⏳';
        contextText += `${c.daysAgo}d ago: "${c.query}" ${outcome}\n`;
      });
    }

    // Add irrigation history ONLY if included
    if (irrigationHistory) {
      contextText += `\n=== IRRIGATION PATTERN ===\n`;
      contextText += `Recent: ${irrigationHistory.totalEvents} events, ${irrigationHistory.totalMinutes} min total\n`;
      if (irrigationHistory.pattern) {
        contextText += `${irrigationHistory.pattern}\n`;
      }
    }

    // Add farmer profile ONLY if included
    if (farmerProfile && farmerProfile.preferredMethods && farmerProfile.preferredMethods.length > 0) {
      contextText += `\n=== FARMER PREFERENCES ===\n`;
      contextText += `Methods: ${farmerProfile.preferredMethods.join(', ')}\n`;
      if (farmerProfile.topIssues && farmerProfile.topIssues.length > 0) {
        contextText += `Common Issues: ${farmerProfile.topIssues.join(', ')}\n`;
      }
    }

    return contextText.trim();
  }

  /**
   * Store conversation outcome (for learning)
   */
  async storeConversation(conversationData) {
    try {
      const conversation = await Conversation.create(conversationData);
      
      // Update farm profile query count
      const profile = await FarmProfile.getOrCreate(conversationData.userId);
      await profile.incrementQueryType(conversationData.queryType);
      
      console.log('✅ Conversation stored:', conversation._id);
      return conversation;
    } catch (error) {
      console.error('❌ Error storing conversation:', error);
      throw error;
    }
  }

  /**
   * Update conversation outcome when farmer takes action
   */
  async updateConversationOutcome(conversationId, actionTaken, wasSuccessful) {
    try {
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      await conversation.markActionTaken(actionTaken, wasSuccessful);
      
      // Update farm profile
      const profile = await FarmProfile.getOrCreate(conversation.userId);
      
      if (wasSuccessful) {
        await profile.addSuccessfulAction(
          actionTaken,
          conversation.queryType,
          'Action completed successfully',
          'N/A',
          conversation.cropType
        );
      }
      
      console.log('✅ Conversation outcome updated:', conversationId);
      return conversation;
    } catch (error) {
      console.error('❌ Error updating outcome:', error);
      throw error;
    }
  }
}

module.exports = new MemoryService();