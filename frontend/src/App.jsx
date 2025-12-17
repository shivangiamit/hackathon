import React, { useState, useEffect, useCallback } from "react";
import { TrendingUp, Camera, MessageSquare } from "lucide-react";
import { Header } from "./components/Header";
import { Dashboard } from "./components/Dashboard";
import { CropHealth } from "./components/CropHealth";
import { Chat } from "./components/Chat";
import { useWebSocket } from "./hooks/useWebSocket";
import { api } from "./services/api";
import "./App.css";

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
    console.log("🔄 Updating sensor data:", data);
    setSensorData((prev) => ({
      ...prev,
      temperature: data.temperature ?? prev.temperature,
      humidity: data.humidity ?? prev.humidity,
      moisture: data.moisture ?? prev.moisture,
      ph: data.ph ?? prev.ph,
      nitrogen: data.nitrogen ?? prev.nitrogen,
      phosphorus: data.phosphorus ?? prev.phosphorus,
      potassium: data.potassium ?? prev.potassium,
      motorStatus: data.motorStatus ?? prev.motorStatus,
      crop: data.crop ?? prev.crop,
      manualMode: data.manualMode ?? prev.manualMode,
    }));
  }, []);

  const handleMotorUpdate = useCallback((status) => {
    console.log("⚡ Motor status:", status);
    setSensorData((prev) => ({ ...prev, motorStatus: status }));
  }, []);

  const handleAlert = useCallback((message) => {
    console.log("⚠️ Alert:", message);
    alert(message);
  }, []);

  const { connected: wsConnected } = useWebSocket(
    handleSensorUpdate,
    handleMotorUpdate,
    handleAlert
  );

  // Fetch history data
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        console.log("📈 Fetching sensor history...");
        const res = await fetch(`${API_URL}/sensor/recent?hours=24`);
        if (!res.ok) throw new Error("Failed to fetch history");

        const result = await res.json();
        console.log("📊 API Response:", result);

        // Format data for chart
        if (result.success && result.data && Array.isArray(result.data)) {
          const formattedData = result.data.map((item, index) => ({
            timestamp: new Date(item.timestamp).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            moisture: item.moisture,
            temperature: item.temperature,
            humidity: item.humidity,
            ph: item.ph,
            nitrogen: item.nitrogen,
            phosphorus: item.phosphorus,
            potassium: item.potassium,
          }));

          console.log(`✅ Fetched ${formattedData.length} historical readings`);
          setHistory(formattedData);
        } else {
          console.warn("⚠️ No data in response");
          setHistory([]);
        }
      } catch (error) {
        console.error("Error fetching history:", error);
        setHistory([]);
      }
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, []);

  // Control handlers
  const handleChangeCrop = async () => {
    try {
      await api.changeCrop(selectedCrop);
      setSensorData((prev) => ({ ...prev, crop: selectedCrop }));
    } catch (error) {
      console.error("Error changing crop:", error);
    }
  };

  const handleToggleMotor = async () => {
    try {
      const newStatus = !sensorData.motorStatus;
      await api.toggleMotor(newStatus);
    } catch (error) {
      console.error("Error controlling motor:", error);
    }
  };

  const handleToggleManualMode = async () => {
    try {
      const newMode = !manualMode;
      await api.toggleManualMode(newMode);
      setManualMode(newMode);
    } catch (error) {
      console.error("Error toggling manual mode:", error);
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

  // Disease detection handlers
  const analyzePlantImage = async (base64Image) => {
    setIsAnalyzing(true);

    try {
      const data = await api.analyzePlantImage(base64Image);
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

  const handleClearImage = () => {
    setDiseaseImage(null);
    setDiseaseResult(null);
  };

  return (
    <div className="app">
      <Header wsConnected={wsConnected} uptime={sensorData.uptime} />

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
          <Dashboard
            sensorData={sensorData}
            history={Array.isArray(history) ? history : []}
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
            onClearImage={handleClearImage}
          />
        )}

        {activeTab === "chat" && (
          <Chat
            messages={chatMessages}
            userInput={userInput}
            setUserInput={setUserInput}
            isAiTyping={isAiTyping}
            setIsAiTyping={setIsAiTyping}
            onSendMessage={handleSendMessage}
          />
        )}
      </main>
    </div>
  );
}

export default App;
