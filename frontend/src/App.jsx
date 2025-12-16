import React, { useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Droplet,
  Thermometer,
  Wind,
  AlertTriangle,
  Camera,
  MessageSquare,
  TrendingUp,
  Wifi,
  Clock,
  Power,
  Leaf,
} from "lucide-react";
import "./App.css";

const API_URL = "http://localhost:5000/api";
const WS_URL = "ws://localhost:5000";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sensorData, setSensorData] = useState({
    temperature: 0,
    humidity: 0,
    moisture: 0,
    motorStatus: false,
    crop: "Tomato",
    manualMode: false,
    wifi: -50,
    uptime: 0,
  });
  const [history, setHistory] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState("Tomato");
  const [manualMode, setManualMode] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { type: "ai", text: "Hello! Ask me anything about your farm." },
  ]);
  const [userInput, setUserInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [diseaseImage, setDiseaseImage] = useState(null);
  const [diseaseResult, setDiseaseResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);

  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        const { type, data } = JSON.parse(event.data);

        if (type === "sensor" || type === "current") {
          setSensorData((prev) => ({ ...prev, ...data }));
        }
        if (type === "motor") {
          setSensorData((prev) => ({ ...prev, motorStatus: data.status }));
        }
        if (type === "alert") {
          alert(data.message);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setWsConnected(false);
        setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/sensors/history?limit=20`);
        const data = await res.json();
        setHistory(data);
      } catch (error) {
        console.error("Error fetching history:", error);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  const changeCrop = async () => {
    try {
      await fetch(`${API_URL}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "crop", value: selectedCrop }),
      });
      setSensorData((prev) => ({ ...prev, crop: selectedCrop }));
    } catch (error) {
      console.error("Error changing crop:", error);
    }
  };

  const toggleMotor = async () => {
    try {
      const newStatus = !sensorData.motorStatus;
      await fetch(`${API_URL}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "motor",
          value: newStatus ? "ON" : "OFF",
        }),
      });
    } catch (error) {
      console.error("Error controlling motor:", error);
    }
  };

  const toggleManualMode = async () => {
    try {
      const newMode = !manualMode;
      await fetch(`${API_URL}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual", value: { enabled: newMode } }),
      });
      setManualMode(newMode);
    } catch (error) {
      console.error("Error toggling manual mode:", error);
    }
  };

  const sendChatMessage = async () => {
    if (!userInput.trim()) return;

    setChatMessages((prev) => [...prev, { type: "user", text: userInput }]);
    setIsAiTyping(true);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userInput }),
      });
      const data = await res.json();
      setChatMessages((prev) => [...prev, { type: "ai", text: data.response }]);
    } catch (error) {
      setChatMessages((prev) => [
        ...prev,
        { type: "ai", text: "Error connecting to AI." },
      ]);
    }

    setIsAiTyping(false);
    setUserInput("");
  };

  const analyzePlantImage = async (base64Image) => {
    setIsAnalyzing(true);

    try {
      const res = await fetch(`${API_URL}/disease-detection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64Image }),
      });
      const data = await res.json();
      setDiseaseResult(data);
    } catch (error) {
      setDiseaseResult({
        name: "Error",
        confidence: 0,
        severity: "Unknown",
        description: "Failed to analyze image",
        causes: [],
        treatment: [],
        prevention: "",
      });
    }

    setIsAnalyzing(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDiseaseImage(reader.result);
        setDiseaseResult(null);
        analyzePlantImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearImage = () => {
    setDiseaseImage(null);
    setDiseaseResult(null);
  };

  const getMoistureStatus = () => {
    if (sensorData.moisture < 40) return { text: "LOW", color: "red" };
    if (sensorData.moisture > 70) return { text: "HIGH", color: "blue" };
    return { text: "GOOD", color: "green" };
  };

  const crops = [
    "Tomato",
    "Rice",
    "Wheat",
    "Potato",
    "Chilli",
    "Sugarcane",
    "Cotton",
    "Lettuce",
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Leaf size={32} />
            <h1>AgriSmart AI</h1>
          </div>
          <div className="status">
            <div
              className={`status-indicator ${
                wsConnected ? "connected" : "disconnected"
              }`}
            >
              <Wifi size={16} />
              {wsConnected ? "Connected" : "Disconnected"}
            </div>
            <div className="uptime">
              <Clock size={16} />
              {Math.floor(sensorData.uptime / 60)}m
            </div>
          </div>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === "dashboard" ? "active" : ""}
          onClick={() => setActiveTab("dashboard")}
        >
          <TrendingUp size={20} />
          Dashboard
        </button>
        <button
          className={activeTab === "health" ? "active" : ""}
          onClick={() => setActiveTab("health")}
        >
          <Camera size={20} />
          Crop Health
        </button>
        <button
          className={activeTab === "chat" ? "active" : ""}
          onClick={() => setActiveTab("chat")}
        >
          <MessageSquare size={20} />
          AI Assistant
        </button>
      </nav>

      <main className="content">
        {activeTab === "dashboard" && (
          <div className="dashboard">
            <div className="alert-box">
              <AlertTriangle size={20} />
              <div>
                <strong>Smart Irrigation Active</strong>
                <p>Monitoring soil moisture for {sensorData.crop}</p>
              </div>
            </div>

            <div className="sensor-cards">
              <div className="card blue">
                <Droplet size={32} />
                <div className="card-content">
                  <h3>{sensorData.moisture}%</h3>
                  <p>Soil Moisture</p>
                  <span className={`badge ${getMoistureStatus().color}`}>
                    {getMoistureStatus().text}
                  </span>
                </div>
              </div>

              <div className="card orange">
                <Thermometer size={32} />
                <div className="card-content">
                  <h3>{sensorData.temperature}°C</h3>
                  <p>Temperature</p>
                  <span className="badge green">OPTIMAL</span>
                </div>
              </div>

              <div className="card purple">
                <Wind size={32} />
                <div className="card-content">
                  <h3>{sensorData.humidity}%</h3>
                  <p>Humidity</p>
                  <span className="badge green">GOOD</span>
                </div>
              </div>
            </div>

            <div className="control-panel">
              <div className="crop-selector">
                <label>Current Crop</label>
                <div className="input-group">
                  <select
                    value={selectedCrop}
                    onChange={(e) => setSelectedCrop(e.target.value)}
                  >
                    {crops.map((crop) => (
                      <option key={crop} value={crop}>
                        {crop}
                      </option>
                    ))}
                  </select>
                  <button onClick={changeCrop}>Change</button>
                </div>
              </div>

              <div className="motor-control">
                <label>Irrigation Control</label>
                <div className="motor-status">
                  <Power
                    size={24}
                    className={sensorData.motorStatus ? "on" : "off"}
                  />
                  <span>{sensorData.motorStatus ? "RUNNING" : "STOPPED"}</span>
                </div>
                <button
                  className={sensorData.motorStatus ? "danger" : "success"}
                  onClick={toggleMotor}
                  disabled={!manualMode}
                >
                  {sensorData.motorStatus ? "STOP MOTOR" : "START MOTOR"}
                </button>
              </div>

              <div className="manual-mode">
                <label>
                  <input
                    type="checkbox"
                    checked={manualMode}
                    onChange={toggleManualMode}
                  />
                  Manual Override Mode
                </label>
                <small>
                  {manualMode ? "Auto irrigation disabled" : "Auto mode active"}
                </small>
              </div>
            </div>

            <div className="chart-container">
              <h3>Sensor Trends (Last 20 readings)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" hide />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="moisture"
                    stroke="#3b82f6"
                    name="Moisture %"
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f97316"
                    name="Temp °C"
                  />
                  <Line
                    type="monotone"
                    dataKey="humidity"
                    stroke="#a855f7"
                    name="Humidity %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "health" && (
          <div className="health-tab">
            <div className="upload-box">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                id="imageUpload"
                hidden
              />
              <label htmlFor="imageUpload" className="upload-label">
                {diseaseImage ? (
                  <img
                    src={diseaseImage}
                    alt="Plant"
                    className="preview-image"
                  />
                ) : (
                  <div className="upload-placeholder">
                    <Camera size={48} />
                    <p>Click to upload plant image</p>
                  </div>
                )}
              </label>
              {diseaseImage && (
                <button className="clear-btn" onClick={clearImage}>
                  Upload New Image
                </button>
              )}
            </div>

            {isAnalyzing && (
              <div className="analyzing">
                <div className="spinner"></div>
                <p>Analyzing plant health...</p>
              </div>
            )}

            {diseaseResult && !isAnalyzing && (
              <div className="disease-result">
                <div
                  className={`result-header ${diseaseResult.severity.toLowerCase()}`}
                >
                  <h2>{diseaseResult.name}</h2>
                  <span className="confidence">
                    {diseaseResult.confidence}% Confidence
                  </span>
                </div>
                <p className="description">{diseaseResult.description}</p>

                {diseaseResult.causes.length > 0 && (
                  <div className="section">
                    <h4>Causes:</h4>
                    <ul>
                      {diseaseResult.causes.map((cause, i) => (
                        <li key={i}>{cause}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="section">
                  <h4>Treatment:</h4>
                  <ol>
                    {diseaseResult.treatment.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>

                {diseaseResult.prevention && (
                  <div className="section">
                    <h4>Prevention:</h4>
                    <p>{diseaseResult.prevention}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "chat" && (
          <div className="chat-tab">
            <div className="chat-messages">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`message ${msg.type}`}>
                  <p>{msg.text}</p>
                </div>
              ))}
              {isAiTyping && (
                <div className="message ai">
                  <p className="typing">AI is thinking...</p>
                </div>
              )}
            </div>

            <div className="chat-input">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                placeholder="Ask about your farm..."
              />
              <button onClick={sendChatMessage}>Send</button>
            </div>

            <div className="quick-questions">
              {[
                "What should I do today?",
                "Check soil moisture",
                "Fertilizer advice",
              ].map((q, i) => (
                <button key={i} onClick={() => setUserInput(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
