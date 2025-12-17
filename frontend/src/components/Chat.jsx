import React, { useEffect, useState } from "react";
import {
  Send,
  AlertCircle,
  CheckCircle,
  Lightbulb,
  ListTodo,
} from "lucide-react";

export const Chat = ({
  messages,
  userInput,
  setUserInput,
  isAiTyping,
  onSendMessage,
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const messagesEndRef = React.useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  // Load suggestions on mount
  useEffect(() => {
    const loadSuggestions = async () => {
      try {
        const { api } = await import("../services/api");
        const result = await api.getChatSuggestions();
        if (result.success) {
          setSuggestions(result.suggestions || []);
        }
      } catch (error) {
        console.error("Error loading suggestions:", error);
        // Default suggestions
        setSuggestions([
          "What should I do today?",
          "Check crop health",
          "Irrigation advice",
        ]);
      }
      setLoadingSuggestions(false);
    };

    loadSuggestions();
  }, []);

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;

    onSendMessage();
  };

  const handleQuickQuestion = (question) => {
    setUserInput(question);
    // Optionally send immediately
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  return (
    <div className="chat-tab">
      {/* Messages Area */}
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.type}`}>
            {msg.type === "user" ? (
              <p>{msg.text}</p>
            ) : (
              <>
                {/* Main Response */}
                {msg.text && (
                  <div className="ai-response-main">
                    <p>{msg.text}</p>
                  </div>
                )}

                {/* Insights Section */}
                {msg.insights && Object.keys(msg.insights).length > 0 && (
                  <div className="ai-insights">
                    <div className="insights-header">
                      <Lightbulb size={16} />
                      <span>Key Insights</span>
                    </div>
                    {Object.entries(msg.insights).map(([key, value]) => (
                      <div key={key} className="insight-item">
                        <span className="insight-key">{key}:</span>
                        <span className="insight-value">{value}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions Section */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="ai-actions">
                    <div className="actions-header">
                      <ListTodo size={16} />
                      <span>Recommended Actions</span>
                    </div>
                    {msg.actions.map((action, idx) => (
                      <div
                        key={idx}
                        className={`action-item priority-${action.priority}`}
                      >
                        <div className="action-priority">
                          {action.priority === "urgent" && "🔴"}
                          {action.priority === "high" && "🟠"}
                          {action.priority === "medium" && "🟡"}
                          {action.priority === "low" && "🟢"}
                        </div>
                        <div className="action-content">
                          <p className="action-text">{action.action}</p>
                          <span className="priority-label">
                            {action.priority}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Alerts Section */}
                {msg.alerts && msg.alerts.length > 0 && (
                  <div className="ai-alerts">
                    {msg.alerts.map((alert, idx) => (
                      <div key={idx} className="alert-item">
                        <AlertCircle size={16} />
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Processing Info */}
                {msg.processingTime && (
                  <div className="processing-info">
                    ⏱️ Processed in {(msg.processingTime / 1000).toFixed(2)}s
                  </div>
                )}
              </>
            )}
          </div>
        ))}

        {isAiTyping && (
          <div className="message ai">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p className="typing">AgriSmart is thinking...</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Ask about your farm..."
          disabled={isAiTyping}
        />
        <button onClick={handleSendMessage} disabled={isAiTyping}>
          <Send size={20} />
        </button>
      </div>

      {/* Quick Suggestions */}
      {!loadingSuggestions && suggestions.length > 0 && (
        <div className="quick-suggestions">
          <div className="suggestions-label">Quick Questions:</div>
          <div className="suggestions-grid">
            {suggestions.map((q, i) => (
              <button
                key={i}
                className="suggestion-btn"
                onClick={() => handleQuickQuestion(q)}
                disabled={isAiTyping}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
