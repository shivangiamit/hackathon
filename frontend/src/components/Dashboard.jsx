import React from "react";
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
  Power,
  Beaker,
  Sprout,
} from "lucide-react";
import { SensorCard } from "./SensorCard.jsx";

export const Dashboard = ({
  sensorData,
  history,
  selectedCrop,
  setSelectedCrop,
  onChangeCrop,
  manualMode,
  onToggleManualMode,
  onToggleMotor,
}) => {
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

  const getStatus = (val, low, high) => {
    if (val < low) return { text: "LOW", color: "red" };
    if (val > high) return { text: "HIGH", color: "blue" };
    return { text: "GOOD", color: "green" };
  };

  // Debug: Log history data
  console.log("📊 Dashboard rendering with history:", history.length, "points");
  if (history.length > 0) {
    console.log("Sample history entry:", history[0]);
  }

  // Custom tooltip for chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="custom-tooltip"
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: "10px",
            borderRadius: "5px",
            color: "white",
            fontSize: "12px",
          }}
        >
          <p style={{ marginBottom: "5px", fontWeight: "bold" }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ margin: "2px 0", color: entry.color }}>
              {entry.name}:{" "}
              {typeof entry.value === "number"
                ? entry.value.toFixed(1)
                : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="dashboard">
      <div className="alert-box">
        <AlertTriangle size={20} />
        <div>
          <strong>Smart Irrigation Active</strong>
          <p>Monitoring soil moisture for {sensorData.crop}</p>
        </div>
      </div>

      <div className="sensor-cards">
        <SensorCard
          icon={Droplet}
          value={`${sensorData.moisture.toFixed(1)}%`}
          label="Moisture"
          status={getStatus(sensorData.moisture, 40, 70)}
          colorClass="blue"
        />
        <SensorCard
          icon={Thermometer}
          value={`${sensorData.temperature.toFixed(1)}°C`}
          label="Temp"
          status={{ text: "OPTIMAL", color: "green" }}
          colorClass="orange"
        />
        <SensorCard
          icon={Wind}
          value={`${sensorData.humidity.toFixed(1)}%`}
          label="Humidity"
          status={{ text: "GOOD", color: "green" }}
          colorClass="purple"
        />
        <SensorCard
          icon={Beaker}
          value={sensorData.ph.toFixed(1)}
          label="Soil PH"
          status={getStatus(sensorData.ph, 5.5, 7.5)}
          colorClass="green"
        />
        <SensorCard
          icon={Sprout}
          value={Math.round(sensorData.nitrogen)}
          label="Nitrogen"
          status={getStatus(sensorData.nitrogen, 100, 250)}
          colorClass="teal"
        />
        <SensorCard
          icon={Sprout}
          value={Math.round(sensorData.phosphorus)}
          label="Phosphorus"
          status={getStatus(sensorData.phosphorus, 30, 100)}
          colorClass="indigo"
        />
        <SensorCard
          icon={Sprout}
          value={Math.round(sensorData.potassium)}
          label="Potassium"
          status={getStatus(sensorData.potassium, 80, 300)}
          colorClass="pink"
        />
      </div>

      <div className="control-panel">
        <div className="crop-selector">
          <label>Current Crop</label>
          <div className="input-group">
            <select
              value={selectedCrop}
              onChange={(e) => setSelectedCrop(e.target.value)}
            >
              {crops.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button onClick={onChangeCrop}>Change</button>
          </div>
        </div>

        <div className="motor-control">
          <label>
            Irrigation: {sensorData.motorStatus ? "RUNNING" : "STOPPED"}
          </label>
          <button
            className={sensorData.motorStatus ? "danger" : "success"}
            onClick={onToggleMotor}
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
              onChange={onToggleManualMode}
            />{" "}
            Manual Mode
          </label>
        </div>
      </div>

      <div className="chart-container">
        <h3>Sensor Trends (Last 24 Hours)</h3>
        {history.length === 0 ? (
          <div
            style={{
              height: "350px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
            }}
          >
            <div>
              <p style={{ fontSize: "18px", marginBottom: "10px" }}>
                📊 Loading sensor data...
              </p>
              <p style={{ fontSize: "14px" }}>Waiting for sensor readings</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart
              data={history}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#444" />
              <XAxis
                dataKey="timestamp"
                stroke="#888"
                style={{ fontSize: "12px" }}
                interval="preserveStartEnd"
              />
              <YAxis stroke="#888" style={{ fontSize: "12px" }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="line" />
              <Line
                type="monotone"
                dataKey="moisture"
                stroke="#3b82f6"
                name="Moisture %"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#f97316"
                name="Temp °C"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="humidity"
                stroke="#a855f7"
                name="Humidity %"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="ph"
                stroke="#10b981"
                name="PH"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="nitrogen"
                stroke="#14b8a6"
                name="Nitrogen"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="phosphorus"
                stroke="#6366f1"
                name="Phosphorus"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
              />
              <Line
                type="monotone"
                dataKey="potassium"
                stroke="#ec4899"
                name="Potassium"
                strokeWidth={2}
                dot={false}
                isAnimationActive={true}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
