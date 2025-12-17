import React from "react";

export const Chat = ({
  messages,
  userInput,
  setUserInput,
  isAiTyping,
  onSendMessage,
}) => {
  const quickQuestions = [
    "What should I do today?",
    "Check soil moisture",
    "Fertilizer advice",
  ];

  return (
    <div className="chat-tab">
      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.type}`}>
            <p>{msg.text}</p>
          </div>
        ))}
        {isAiTyping && (
          <div className="message ai">
            <p className="typing">AI is thinking...</p>
          </div>
        )}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && onSendMessage()}
          placeholder="Ask about your farm..."
        />
        <button onClick={onSendMessage}>Send</button>
      </div>

      <div className="quick-questions">
        {quickQuestions.map((q, i) => (
          <button key={i} onClick={() => setUserInput(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
};
