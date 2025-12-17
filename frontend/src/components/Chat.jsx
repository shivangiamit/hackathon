import React, { useEffect, useState } from "react";
import {
  Send,
  Mic,
  Square,
  Volume2,
  VolumeX,
  Download,
  Globe,
} from "lucide-react";
import { useVoice } from "../hooks/useVoice";
import { api } from "../services/api";

export const Chat = ({
  messages,
  userInput,
  setUserInput,
  isAiTyping,
  onSendMessage,
}) => {
  // Voice functionality
  const voice = useVoice();
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [languages, setLanguages] = useState([]);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState("nova");
  const [isVoiceChat, setIsVoiceChat] = useState(false);
  const [voiceChatResult, setVoiceChatResult] = useState(null);

  const messagesEndRef = React.useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAiTyping]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load suggestions
        const { api: apiModule } = await import("../services/api");
        const result = await apiModule.getChatSuggestions();
        if (result.success) {
          setSuggestions(result.suggestions || []);
        }

        // Load languages
        const langResult =
          (await apiModule.getVoiceLanguages?.()) ||
          (await fetch("http://localhost:5000/api/voice/languages").then((r) =>
            r.json()
          ));
        if (langResult.success) {
          setLanguages(langResult.languages || []);
        }

        // Load voices
        const voiceResult =
          (await apiModule.getVoiceVoices?.()) ||
          (await fetch("http://localhost:5000/api/voice/voices").then((r) =>
            r.json()
          ));
        if (voiceResult.success) {
          setVoices(voiceResult.voices || []);
        }
      } catch (error) {
        console.error("Error loading initial data:", error);
        setSuggestions([
          "What should I do today?",
          "Check crop health",
          "Irrigation advice",
        ]);
      }
      setLoadingSuggestions(false);
    };

    loadInitialData();
  }, []);

  // Handle voice chat completion
  const handleVoiceChat = async () => {
    try {
      setIsVoiceChat(true);
      setIsAiTyping(true);

      // Start recording
      await voice.startRecording();

      // Show UI for recording
      console.log("🎤 Recording... Press stop when done");

      return {
        stopRecording: async () => {
          const audioBlob = await voice.stopRecording();

          if (audioBlob) {
            // Process through voice endpoint
            const result = await voice.processAudio(audioBlob);

            if (result) {
              // Add messages
              const updatedMessages = [
                ...messages,
                { type: "user", text: result.query },
                {
                  type: "ai",
                  text: result.response,
                  insights: result.insights,
                  actions: result.actions,
                  alerts: result.alerts,
                  audio: result.audio,
                  audioFormat: result.audioFormat,
                  language: result.language,
                  processingTime: result.processingTime,
                },
              ];

              setVoiceChatResult(result);

              // Auto-play response
              if (result.audio) {
                voice.playAudio(result.audio);
              }
            }
          }

          setIsVoiceChat(false);
          setIsAiTyping(false);
        },
      };
    } catch (error) {
      console.error("Voice chat error:", error);
      setIsVoiceChat(false);
      setIsAiTyping(false);
      voice.setError(error.message);
    }
  };

  const handleSendMessage = async () => {
    if (!userInput.trim()) return;
    onSendMessage();
  };

  const handleQuickQuestion = (question) => {
    setUserInput(question);
    setTimeout(() => {
      handleSendMessage();
    }, 100);
  };

  const downloadAudio = (base64Audio, filename = "response.mp3") => {
    try {
      const binary = atob(base64Audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  return (
    <div className="chat-tab">
      {/* Voice Controls Section */}
      <div className="voice-controls">
        <div className="voice-controls-top">
          {/* Language Selector */}
          <div className="language-selector">
            <Globe size={16} />
            <select
              value={voice.language}
              onChange={(e) => voice.setLanguage(e.target.value)}
              disabled={isAiTyping || voice.isRecording}
              className="language-select"
            >
              {languages.length > 0 ? (
                languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))
              ) : (
                <option value="en">English</option>
              )}
            </select>
          </div>

          {/* Voice Selector */}
          <div className="voice-selector">
            <Volume2 size={16} />
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              disabled={isAiTyping || voice.isRecording}
              className="voice-select"
            >
              {voices.length > 0 ? (
                voices.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.name} - {v.description}
                  </option>
                ))
              ) : (
                <option value="nova">Nova (Default)</option>
              )}
            </select>
          </div>

          {/* Recording Status */}
          {voice.isRecording && (
            <div className="recording-status">
              <div className="recording-dot"></div>
              <span>{voice.duration}s</span>
            </div>
          )}

          {/* Error Display */}
          {voice.error && (
            <div className="voice-error">
              <span className="error-message">⚠️ {voice.error}</span>
            </div>
          )}
        </div>
      </div>

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

                {/* Language Badge */}
                {msg.language && (
                  <div className="language-badge">
                    🌍 {msg.language.toUpperCase()}
                  </div>
                )}

                {/* Insights Section */}
                {msg.insights && Object.keys(msg.insights).length > 0 && (
                  <div className="ai-insights">
                    <div className="insights-header">💡 Key Insights</div>
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
                    <div className="actions-header">✅ Recommended Actions</div>
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
                        <span>{alert}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Audio Playback */}
                {msg.audio && (
                  <div className="audio-playback">
                    <button
                      className="play-button"
                      onClick={() => voice.playAudio(msg.audio)}
                      disabled={voice.isPlaying}
                    >
                      {voice.isPlaying ? "⏸️ Playing..." : "🔊 Play Audio"}
                    </button>
                    <button
                      className="download-button"
                      onClick={() =>
                        downloadAudio(msg.audio, `response-${i}.mp3`)
                      }
                    >
                      <Download size={16} />
                      Download
                    </button>
                  </div>
                )}

                {/* Processing Info */}
                {msg.processingTime && (
                  <div className="processing-info">
                    ⏱️ {(msg.processingTime / 1000).toFixed(2)}s
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

        {voice.isRecording && (
          <div className="message ai recording-message">
            <div className="recording-animation">
              <div className="wave"></div>
              <div className="wave"></div>
              <div className="wave"></div>
            </div>
            <p>Recording... Press Stop to process</p>
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
          placeholder="Type or use voice..."
          disabled={isAiTyping || voice.isRecording}
        />

        {/* Voice Chat Button */}
        <button
          className={`voice-button ${voice.isRecording ? "recording" : ""}`}
          onClick={async () => {
            if (!voice.isRecording) {
              const session = await handleVoiceChat();
              if (session) {
                // Show stop button after recording starts
                setTimeout(() => {
                  document.querySelector(".stop-recording-button")?.click?.();
                }, 1000); // Wait for recording to start
              }
            } else {
              await voice.stopRecording();
            }
          }}
          disabled={isAiTyping}
          title={
            voice.isRecording
              ? "Click to stop recording"
              : "Click to start voice chat"
          }
        >
          {voice.isRecording ? (
            <>
              <Square size={20} />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Mic size={20} />
              <span>Voice</span>
            </>
          )}
        </button>

        {/* Text Send Button */}
        <button
          onClick={handleSendMessage}
          disabled={isAiTyping || voice.isRecording}
          title="Send message"
        >
          <Send size={20} />
        </button>
      </div>

      {/* Quick Suggestions */}
      {!loadingSuggestions && suggestions.length > 0 && (
        <div className="quick-suggestions">
          <div className="suggestions-label">💬 Quick Questions:</div>
          <div className="suggestions-grid">
            {suggestions.map((q, i) => (
              <button
                key={i}
                className="suggestion-btn"
                onClick={() => handleQuickQuestion(q)}
                disabled={isAiTyping || voice.isRecording}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Voice Info Footer */}
      <div className="voice-info">
        <small>
          🎤 Supports Hindi, Marathi, English, Tamil, Telugu & 35+ languages
          {voice.language && ` • Current: ${voice.language.toUpperCase()}`}
        </small>
      </div>
    </div>
  );
};
