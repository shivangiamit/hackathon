import { useEffect, useRef, useState } from "react";

const WS_URL = "ws://localhost:5000";

export const useWebSocket = (onSensorUpdate, onMotorUpdate, onAlert) => {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log("WebSocket connected");
        setConnected(true);
      };

      ws.onmessage = (event) => {
        const { type, data } = JSON.parse(event.data);

        if (type === "sensor" || type === "current") {
          onSensorUpdate(data);
        }
        if (type === "motor") {
          onMotorUpdate(data.status);
        }
        if (type === "alert") {
          onAlert(data.message);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setConnected(false);
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
  }, [onSensorUpdate, onMotorUpdate, onAlert]);

  return { connected };
};