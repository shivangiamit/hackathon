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
import { SensorCard } from "./Sensorcard.jsx";

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

  const getMoistureStatus = () => {
    if (sensorData.moisture < 40) return { text: "LOW", color: "red" };
    if (sensorData.moisture > 70) return { text: "HIGH", color: "blue" };
    return { text: "GOOD", color: "green" };
  };

  const getPhStatus = () => {
    if (sensorData.ph < 5.5) return { text: "ACIDIC", color: "red" };
    if (sensorData.ph > 7.5) return { text: "ALKALINE", color: "blue" };
    return { text: "OPTIMAL", color: "green" };
  };

  const getNutrientStatus = (value, type) => {
    const thresholds = {
      nitrogen: { low: 100, high: 250 },
      phosphorus: { low: 30, high: 100 },
      potassium: { low: 80, high: 300 },
    };
    const t = thresholds[type];
    if (value < t.low) return { text: "LOW", color: "red" };
    if (value > t.high) return { text: "HIGH", color: "blue" };
    return { text: "GOOD", color: "green" };
  };

  // Prepare chart data - ensure it's always an array
  const chartData =
    Array.isArray(history) && history.length > 0
      ? history.map((item, index) => ({
          name: `Reading ${index + 1}`,
          timestamp: item.timestamp || `T${index}`,
          moisture: parseFloat(item.moisture) || 0,
          temperature: parseFloat(item.temperature) || 0,
          humidity: parseFloat(item.humidity) || 0,
          ph: parseFloat(item.ph) || 0,
        }))
      : [
          // Dummy data for when no history exists
          {
            name: "Reading 1",
            timestamp: "T1",
            moisture: sensorData.moisture,
            temperature: sensorData.temperature,
            humidity: sensorData.humidity,
            ph: sensorData.ph,
          },
        ];

  console.log("📊 Chart data prepared:", chartData);

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
          label="Soil Moisture"
          status={getMoistureStatus()}
          colorClass="blue"
        />
        <SensorCard
          icon={Thermometer}
          value={`${sensorData.temperature}°C`}
          label="Temperature"
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
          status={getPhStatus()}
          colorClass="green"
        />
        <SensorCard
          icon={Sprout}
          value={sensorData.nitrogen}
          label="Nitrogen (ppm)"
          status={getNutrientStatus(sensorData.nitrogen, "nitrogen")}
          colorClass="teal"
        />
        <SensorCard
          icon={Sprout}
          value={sensorData.phosphorus}
          label="Phosphorus (ppm)"
          status={getNutrientStatus(sensorData.phosphorus, "phosphorus")}
          colorClass="indigo"
        />
        <SensorCard
          icon={Sprout}
          value={sensorData.potassium}
          label="Potassium (ppm)"
          status={getNutrientStatus(sensorData.potassium, "potassium")}
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
              {crops.map((crop) => (
                <option key={crop} value={crop}>
                  {crop}
                </option>
              ))}
            </select>
            <button onClick={onChangeCrop}>Change</button>
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
        {chartData && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tick={{ fontSize: 12 }}
                interval={Math.floor(chartData.length / 6)}
              />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#f5f5f5",
                  border: "1px solid #ccc",
                }}
                formatter={(value) => parseFloat(value).toFixed(2)}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="moisture"
                stroke="#3b82f6"
                name="Moisture %"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#f97316"
                name="Temp °C"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="humidity"
                stroke="#a855f7"
                name="Humidity %"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="ph"
                stroke="#10b981"
                name="PH"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: "center", padding: "40px", color: "#999" }}>
            <p>Waiting for sensor data...</p>
          </div>
        )}
      </div>
    </div>
  );
};
