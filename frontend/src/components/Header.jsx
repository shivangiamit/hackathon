import React from "react";
import { Leaf, Wifi, Clock } from "lucide-react";

export const Header = ({ wsConnected, uptime }) => {
  return (
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
            {Math.floor(uptime / 60)}m
          </div>
        </div>
      </div>
    </header>
  );
};
