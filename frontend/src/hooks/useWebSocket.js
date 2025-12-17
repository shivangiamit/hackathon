import { useEffect, useRef, useState } from "react";

const WS_URL = "ws://localhost:5000";

export const useWebSocket = (onSensorUpdate, onMotorUpdate, onAlert) => {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
          console.log("✅ WebSocket connected");
          setConnected(true);
          
          // Clear any pending reconnect timers
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log("📨 WebSocket message received:", message.type);

            if (message.type === "sensor" && message.data) {
              console.log("📊 Sensor data:", message.data);
              onSensorUpdate(message.data);
            }

            if (message.type === "motor" && message.data) {
              console.log("⚡ Motor status:", message.data.status);
              onMotorUpdate(message.data.status);
            }

            if (message.type === "alert" && message.data) {
              console.log("⚠️ Alert:", message.data.message);
              onAlert(message.data.message);
            }

            if (message.type === "pong") {
              console.log("🏓 Pong received");
            }
          } catch (error) {
            console.error("❌ Error parsing WebSocket message:", error);
          }
        };

        ws.onclose = () => {
          console.log("❌ WebSocket disconnected");
          setConnected(false);
          
          // Attempt reconnection after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log("🔄 Attempting to reconnect...");
            connectWebSocket();
          }, 3000);
        };

        ws.onerror = (error) => {
          console.error("❌ WebSocket error:", error);
          setConnected(false);
        };

        wsRef.current = ws;
      } catch (error) {
        console.error("❌ WebSocket connection error:", error);
        setConnected(false);
        
        // Retry after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    };

    connectWebSocket();

    return () => {
      // Cleanup
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [onSensorUpdate, onMotorUpdate, onAlert]);

  return { connected };
};