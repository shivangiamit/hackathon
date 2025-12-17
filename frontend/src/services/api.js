const API_URL = "http://localhost:5000/api";

export const api = {
  // Sensor data
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

  // Control
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

  // AI Services
  sendChatMessage: async (message) => {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
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