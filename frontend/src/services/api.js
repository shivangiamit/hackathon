const API_URL = "http://localhost:5000/api";

export const api = {
  // ==================== SENSOR DATA ====================
  getCurrentSensors: async () => {
    const res = await fetch(`${API_URL}/sensors/current`);
    return res.json();
  },

  getHistory: async (limit = 20) => {
    const res = await fetch(`${API_URL}/sensors/history?limit=${limit}`);
    return res.json();
  },

  getAnalytics: async () => {
    const res = await fetch(`${API_URL}/analytics`);
    return res.json();
  },

  // ==================== CONTROL ====================
  controlDevice: async (type, value) => {
    const res = await fetch(`${API_URL}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value }),
    });
    return res.json();
  },

  changeCrop: async (cropName) => {
    return api.controlDevice("crop", cropName);
  },

  toggleMotor: async (status) => {
    return api.controlDevice("motor", status ? "ON" : "OFF");
  },

  toggleManualMode: async (enabled) => {
    return api.controlDevice("manual", { enabled });
  },

  // ==================== AI CHAT (NEW - Phase 4) ====================
  sendChatMessage: async (message, userId = null) => {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        message,
        userId: userId || 'farmer_001'
      }),
    });
    
    if (!res.ok) {
      throw new Error('Failed to send message');
    }
    
    return res.json();
  },

  getChatHistory: async (userId = null, days = 7, limit = 20) => {
    const params = new URLSearchParams({
      userId: userId || 'farmer_001',
      days,
      limit
    });
    
    const res = await fetch(`${API_URL}/chat/history?${params}`);
    return res.json();
  },

  recordChatFeedback: async (conversationId, actionTaken, wasSuccessful, feedback = null, comment = null) => {
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
  },

  getChatSuggestions: async (userId = null) => {
    const params = new URLSearchParams({
      userId: userId || 'farmer_001'
    });
    
    const res = await fetch(`${API_URL}/chat/suggestions?${params}`);
    return res.json();
  },

  // ==================== MEMORY/CONTEXT (NEW - Phase 4) ====================
  getRecentConversations: async (userId = null, days = 7) => {
    const params = new URLSearchParams({
      userId: userId || 'farmer_001',
      days
    });
    
    const res = await fetch(`${API_URL}/memory/conversations?${params}`);
    return res.json();
  },

  getTrends: async (userId = null, days = 7) => {
    const params = new URLSearchParams({
      userId: userId || 'farmer_001',
      days
    });
    
    const res = await fetch(`${API_URL}/memory/trends?${params}`);
    return res.json();
  },

  getFarmProfile: async (userId = null) => {
    const params = new URLSearchParams({
      userId: userId || 'farmer_001'
    });
    
    const res = await fetch(`${API_URL}/memory/profile?${params}`);
    return res.json();
  },

  getIrrigationHistory: async (userId = null, days = 7) => {
    const params = new URLSearchParams({
      userId: userId || 'farmer_001',
      days
    });
    
    const res = await fetch(`${API_URL}/memory/irrigation-history?${params}`);
    return res.json();
  },

  getSuccessfulActions: async (userId = null, limit = 5) => {
    const params = new URLSearchParams({
      userId: userId || 'farmer_001',
      limit
    });
    
    const res = await fetch(`${API_URL}/memory/successful-actions?${params}`);
    return res.json();
  },

  getDailySummaries: async (userId = null, days = 30) => {
    const params = new URLSearchParams({
      userId: userId || 'farmer_001',
      days
    });
    
    const res = await fetch(`${API_URL}/memory/daily-summaries?${params}`);
    return res.json();
  },

  analyzePlantImage: async (imageBase64) => {
    const res = await fetch(`${API_URL}/disease-detection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64 }),
    });
    return res.json();
  },
};