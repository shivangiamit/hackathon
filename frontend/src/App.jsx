import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, Camera, MessageSquare } from "lucide-react";
import { Header } from "./components/Header";
import { Dashboard } from "./components/Dashboard";
import { CropHealth } from "./components/CropHealth";
import { Chat } from "./components/Chat";
import { useWebSocket } from "./hooks/useWebSocket";
import { api } from "./services/api";
import "./App.css";

const API_URL = "http://localhost:5000/api";

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sensorData, setSensorData] = useState({
    temperature: 0,
    humidity: 0,
    moisture: 0,
    ph: 6.5,
    nitrogen: 150,
    phosphorus: 50,
    potassium: 180,
    motorStatus: false,
    crop: "Tomato",
    manualMode: false,
    wifi: -50,
    uptime: 0,
  });
  const [history, setHistory] = useState([]);
  const [selectedCrop, setSelectedCrop] = useState("Tomato");
  const [manualMode, setManualMode] = useState(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState([
    { type: "ai", text: "Hello! Ask me anything about your farm." },
  ]);
  const [userInput, setUserInput] = useState("");
  const [isAiTyping, setIsAiTyping] = useState(false);

  // Disease detection state
  const [diseaseImage, setDiseaseImage] = useState(null);
  const [diseaseResult, setDiseaseResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // WebSocket callbacks
  const handleSensorUpdate = useCallback((data) => {
    console.log("📊 WebSocket sensor update:", data);

    setSensorData((prev) => ({
      ...prev,
      temperature: parseFloat(data.temperature) || prev.temperature,
      humidity: parseFloat(data.humidity) || prev.humidity,
      moisture: parseFloat(data.moisture) || prev.moisture,
      ph: parseFloat(data.ph) || prev.ph,
      nitrogen: parseFloat(data.nitrogen) || prev.nitrogen,
      phosphorus: parseFloat(data.phosphorus) || prev.phosphorus,
      potassium: parseFloat(data.potassium) || prev.potassium,
      motorStatus:
        data.motorStatus !== undefined ? data.motorStatus : prev.motorStatus,
      crop: data.crop || prev.crop,
      manualMode:
        data.manualMode !== undefined ? data.manualMode : prev.manualMode,
    }));

    // Add to history in real-time
    setHistory((prevHistory) => {
      const newEntry = {
        timestamp: new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        moisture: parseFloat(data.moisture) || 0,
        temperature: parseFloat(data.temperature) || 0,
        humidity: parseFloat(data.humidity) || 0,
        ph: parseFloat(data.ph) || 6.5,
        nitrogen: parseFloat(data.nitrogen) || 150,
        phosphorus: parseFloat(data.phosphorus) || 50,
        potassium: parseFloat(data.potassium) || 180,
      };

      // Keep only last 50 data points for performance
      const updatedHistory = [...prevHistory, newEntry].slice(-50);
      return updatedHistory;
    });
  }, []);

  const handleMotorUpdate = useCallback((status) => {
    setSensorData((prev) => ({ ...prev, motorStatus: status }));
  }, []);

  const handleAlert = useCallback((message) => {
    alert(message);
  }, []);

  const { connected: wsConnected } = useWebSocket(
    handleSensorUpdate,
    handleMotorUpdate,
    handleAlert
  );

  // Fetch initial history data
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        console.log("📡 Fetching sensor history...");
        const res = await fetch(`${API_URL}/sensor/recent?hours=24`);

        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }

        const result = await res.json();
        console.log("📊 History API response:", result);

        if (
          result.success &&
          Array.isArray(result.data) &&
          result.data.length > 0
        ) {
          const formattedData = result.data
            .map((item) => {
              const timestamp = new Date(item.timestamp);
              return {
                timestamp: timestamp.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                moisture: parseFloat(item.moisture) || 0,
                temperature: parseFloat(item.temperature) || 0,
                humidity: parseFloat(item.humidity) || 0,
                ph: parseFloat(item.ph) || 6.5,
                nitrogen: parseFloat(item.nitrogen) || 150,
                phosphorus: parseFloat(item.phosphorus) || 50,
                potassium: parseFloat(item.potassium) || 180,
              };
            })
            .slice(-50); // Keep last 50 points

          console.log(
            "✅ Formatted history data:",
            formattedData.length,
            "points"
          );
          console.log("Sample data:", formattedData[0]);
          setHistory(formattedData);
        } else {
          console.warn("⚠️ No history data available, using mock data");
          // Generate mock data for demonstration
          const mockData = generateMockData();
          setHistory(mockData);
        }
      } catch (error) {
        console.error("❌ Error fetching history:", error);
        // Generate mock data on error
        const mockData = generateMockData();
        setHistory(mockData);
      }
    };

    // Fetch immediately
    fetchHistory();

    // Then fetch every 30 seconds
    const interval = setInterval(fetchHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  // Generate mock data for testing
  const generateMockData = () => {
    const data = [];
    const now = new Date();

    for (let i = 0; i < 24; i++) {
      const time = new Date(now - (24 - i) * 60 * 60 * 1000);
      data.push({
        timestamp: time.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        moisture: 45 + Math.random() * 20,
        temperature: 22 + Math.random() * 8,
        humidity: 55 + Math.random() * 20,
        ph: 6.0 + Math.random() * 1.5,
        nitrogen: 120 + Math.random() * 60,
        phosphorus: 40 + Math.random() * 30,
        potassium: 150 + Math.random() * 60,
      });
    }
    return data;
  };

  // Control handlers
  const handleChangeCrop = async () => {
    try {
      await api.changeCrop(selectedCrop);
      setSensorData((prev) => ({ ...prev, crop: selectedCrop }));
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleMotor = async () => {
    try {
      await api.toggleMotor(!sensorData.motorStatus);
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleManualMode = async () => {
    try {
      const newMode = !manualMode;
      await api.toggleManualMode(newMode);
      setManualMode(newMode);
    } catch (error) {
      console.error(error);
    }
  };

  // Chat handlers
  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    setChatMessages((prev) => [...prev, { type: "user", text: userInput }]);
    setIsAiTyping(true);
    try {
      const data = await api.sendChatMessage(userInput);
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

  // Image handlers
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setDiseaseImage(reader.result);
        setDiseaseResult(null);
        setIsAnalyzing(true);
        api
          .analyzePlantImage(reader.result)
          .then(setDiseaseResult)
          .finally(() => setIsAnalyzing(false));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="app">
      <Header wsConnected={wsConnected} uptime={sensorData.uptime} />
      <nav className="tabs">
        <button
          className={activeTab === "dashboard" ? "active" : ""}
          onClick={() => setActiveTab("dashboard")}
        >
          <TrendingUp size={20} /> Dashboard
        </button>
        <button
          className={activeTab === "health" ? "active" : ""}
          onClick={() => setActiveTab("health")}
        >
          <Camera size={20} /> Crop Health
        </button>
        <button
          className={activeTab === "chat" ? "active" : ""}
          onClick={() => setActiveTab("chat")}
        >
          <MessageSquare size={20} /> AI Assistant
        </button>
      </nav>

      <main className="content">
        {activeTab === "dashboard" && (
          <Dashboard
            sensorData={sensorData}
            history={history}
            selectedCrop={selectedCrop}
            setSelectedCrop={setSelectedCrop}
            onChangeCrop={handleChangeCrop}
            manualMode={manualMode}
            onToggleManualMode={handleToggleManualMode}
            onToggleMotor={handleToggleMotor}
          />
        )}
        {activeTab === "health" && (
          <CropHealth
            diseaseImage={diseaseImage}
            diseaseResult={diseaseResult}
            isAnalyzing={isAnalyzing}
            onImageUpload={handleImageUpload}
            onClearImage={() => {
              setDiseaseImage(null);
              setDiseaseResult(null);
            }}
          />
        )}
        {activeTab === "chat" && (
          <Chat
            messages={chatMessages}
            userInput={userInput}
            setUserInput={setUserInput}
            isAiTyping={isAiTyping}
            onSendMessage={handleSendMessage}
          />
        )}
      </main>
    </div>
  );
}

export default App;
