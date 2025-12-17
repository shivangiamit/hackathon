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
          value={`${sensorData.moisture}%`}
          label="Moisture"
          status={getStatus(sensorData.moisture, 40, 70)}
          colorClass="blue"
        />
        <SensorCard
          icon={Thermometer}
          value={`${sensorData.temperature}°C`}
          label="Temp"
          status={{ text: "OPTIMAL", color: "green" }}
          colorClass="orange"
        />
        <SensorCard
          icon={Wind}
          value={`${sensorData.humidity}%`}
          label="Humidity"
          status={{ text: "GOOD", color: "green" }}
          colorClass="purple"
        />
        <SensorCard
          icon={Beaker}
          value={sensorData.ph}
          label="Soil PH"
          status={getStatus(sensorData.ph, 5.5, 7.5)}
          colorClass="green"
        />
        <SensorCard
          icon={Sprout}
          value={sensorData.nitrogen}
          label="Nitrogen"
          status={getStatus(sensorData.nitrogen, 100, 250)}
          colorClass="teal"
        />
        <SensorCard
          icon={Sprout}
          value={sensorData.phosphorus}
          label="Phosphorus"
          status={getStatus(sensorData.phosphorus, 30, 100)}
          colorClass="indigo"
        />
        <SensorCard
          icon={Sprout}
          value={sensorData.potassium}
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
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={history}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="moisture"
              stroke="#3b82f6"
              name="Moisture %"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="temperature"
              stroke="#f97316"
              name="Temp °C"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="humidity"
              stroke="#a855f7"
              name="Humidity %"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="ph"
              stroke="#10b981"
              name="PH"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="nitrogen"
              stroke="#14b8a6"
              name="Nitrogen"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="phosphorus"
              stroke="#6366f1"
              name="Phosphorus"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="potassium"
              stroke="#ec4899"
              name="Potassium"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
