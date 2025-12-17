const API_URL = "http://localhost:5000/api";

export const api = {
  // ==================== SENSOR DATA ====================
  getCurrentSensors: async () => {
    try {
      const res = await fetch(`${API_URL}/sensor/latest`);
      if (!res.ok) throw new Error('Failed to fetch sensors');
      return res.json();
    } catch (error) {
      console.error('Error fetching sensors:', error);
      return {
        success: false,
        data: {
          temperature: 0,
          humidity: 0,
          moisture: 0,
          ph: 6.5,
          nitrogen: 150,
          phosphorus: 50,
          potassium: 180
        }
      };
    }
  },

  getHistory: async (limit = 50) => {
    try {
      const res = await fetch(`${API_URL}/sensor/recent?hours=24`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const result = await res.json();
      
      console.log('📊 API Response:', result);
      
      // Return array format for chart
      if (result.success && result.data && Array.isArray(result.data)) {
        const formattedData = result.data.map((item, index) => ({
          timestamp: new Date(item.timestamp).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
          }),
          moisture: Math.round(item.moisture * 10) / 10,
          temperature: Math.round(item.temperature * 10) / 10,
          humidity: Math.round(item.humidity * 10) / 10,
          ph: Math.round(item.ph * 100) / 100,
          nitrogen: item.nitrogen || 0,
          phosphorus: item.phosphorus || 0,
          potassium: item.potassium || 0
        })).slice(-limit); // Keep only last N items
        
        console.log('✅ Formatted history data:', formattedData);
        return formattedData;
      }
      return [];
    } catch (error) {
      console.error('Error fetching history:', error);
      return [];
    }
  },

  getAnalytics: async () => {
    try {
      const res = await fetch(`${API_URL}/memory/trends?days=7`);
      if (!res.ok) throw new Error('Failed to fetch analytics');
      return res.json();
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return { success: false };
    }
  },

  // ==================== CONTROL ====================
  changeCrop: async (cropName) => {
    try {
      const res = await fetch(`${API_URL}/sensor/latest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cropType: cropName }),
      });
      return res.json();
    } catch (error) {
      console.error('Error changing crop:', error);
      return { success: false };
    }
  },

  toggleMotor: async (status) => {
    try {
      const res = await fetch(`${API_URL}/sensor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motorStatus: status, manualMode: true }),
      });
      return res.json();
    } catch (error) {
      console.error('Error toggling motor:', error);
      return { success: false };
    }
  },

  toggleManualMode: async (enabled) => {
    try {
      const res = await fetch(`${API_URL}/sensor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualMode: enabled }),
      });
      return res.json();
    } catch (error) {
      console.error('Error toggling manual mode:', error);
      return { success: false };
    }
  },

  // ==================== AI CHAT ====================
  sendChatMessage: async (message, userId = null) => {
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message,
          userId: userId || 'farmer_001'
        }),
      });
      
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    } catch (error) {
      console.error('Chat error:', error);
      return {
        success: false,
        response: 'Error connecting to AI assistant. Please try again.'
      };
    }
  },

  getChatHistory: async (userId = null, days = 7, limit = 20) => {
    try {
      const params = new URLSearchParams({
        userId: userId || 'farmer_001',
        days,
        limit
      });
      
      const res = await fetch(`${API_URL}/chat/history?${params}`);
      return res.json();
    } catch (error) {
      console.error('Error fetching chat history:', error);
      return { success: false, data: [] };
    }
  },

  recordChatFeedback: async (conversationId, actionTaken, wasSuccessful, feedback = null, comment = null) => {
    try {
      const res = await fetch(`${API_URL}/chat/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          actionTaken,
          wasSuccessful,
          feedback,
          comment
        }),
      });
      
      return res.json();
    } catch (error) {
      console.error('Error recording feedback:', error);
      return { success: false };
    }
  },

  getChatSuggestions: async (userId = null) => {
    try {
      const params = new URLSearchParams({
        userId: userId || 'farmer_001'
      });
      
      const res = await fetch(`${API_URL}/chat/suggestions?${params}`);
      return res.json();
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      return {
        success: true,
        suggestions: [
          'What should I do today?',
          'Check crop health',
          'Irrigation advice'
        ]
      };
    }
  },

  // ==================== MEMORY/CONTEXT ====================
  getRecentConversations: async (userId = null, days = 7) => {
    try {
      const params = new URLSearchParams({
        userId: userId || 'farmer_001',
        days
      });
      
      const res = await fetch(`${API_URL}/memory/conversations?${params}`);
      return res.json();
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return { success: false, data: [] };
    }
  },

  getTrends: async (userId = null, days = 7) => {
    try {
      const params = new URLSearchParams({
        userId: userId || 'farmer_001',
        days
      });
      
      const res = await fetch(`${API_URL}/memory/trends?${params}`);
      return res.json();
    } catch (error) {
      console.error('Error fetching trends:', error);
      return { success: false };
    }
  },

  getFarmProfile: async (userId = null) => {
    try {
      const params = new URLSearchParams({
        userId: userId || 'farmer_001'
      });
      
      const res = await fetch(`${API_URL}/memory/profile?${params}`);
      return res.json();
    } catch (error) {
      console.error('Error fetching profile:', error);
      return { success: false };
    }
  },

  getIrrigationHistory: async (userId = null, days = 7) => {
    try {
      const params = new URLSearchParams({
        userId: userId || 'farmer_001',
        days
      });
      
      const res = await fetch(`${API_URL}/memory/irrigation-history?${params}`);
      return res.json();
    } catch (error) {
      console.error('Error fetching irrigation history:', error);
      return { success: false };
    }
  },

  getSuccessfulActions: async (userId = null, limit = 5) => {
    try {
      const params = new URLSearchParams({
        userId: userId || 'farmer_001',
        limit
      });
      
      const res = await fetch(`${API_URL}/memory/successful-actions?${params}`);
      return res.json();
    } catch (error) {
      console.error('Error fetching successful actions:', error);
      return { success: false, data: [] };
    }
  },

  getDailySummaries: async (userId = null, days = 30) => {
    try {
      const params = new URLSearchParams({
        userId: userId || 'farmer_001',
        days
      });
      
      const res = await fetch(`${API_URL}/memory/daily-summaries?${params}`);
      return res.json();
    } catch (error) {
      console.error('Error fetching daily summaries:', error);
      return { success: false, data: [] };
    }
  },

  analyzePlantImage: async (imageBase64) => {
    try {
      const res = await fetch(`${API_URL}/disease-detection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });
      
      if (!res.ok) throw new Error('Failed to analyze image');
      return res.json();
    } catch (error) {
      console.error('Error analyzing image:', error);
      return {
        success: false,
        name: 'Error',
        confidence: 0,
        severity: 'Unknown',
        description: 'Failed to analyze image'
      };
    }
  },

  // ==================== VOICE ====================
  getVoiceLanguages: async () => {
    try {
      const res = await fetch(`${API_URL}/voice/languages`);
      return res.json();
    } catch (error) {
      console.error('Error fetching languages:', error);
      return {
        success: true,
        languages: [
          { code: 'en', name: 'English' },
          { code: 'hi', name: 'Hindi' }
        ]
      };
    }
  },

  getVoiceVoices: async () => {
    try {
      const res = await fetch(`${API_URL}/voice/voices`);
      return res.json();
    } catch (error) {
      console.error('Error fetching voices:', error);
      return {
        success: true,
        voices: [
          { code: 'nova', name: 'Nova', description: 'Default' }
        ]
      };
    }
  }
};