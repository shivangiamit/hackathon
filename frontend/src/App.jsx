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
    setSensorData((prev) => ({ ...prev, ...data }));
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

  // Fetch history data
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await api.getHistory(20);
        setHistory(data);
      } catch (error) {
        console.error("Error fetching history:", error);
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
            onClearImage={handleClearImage}
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
